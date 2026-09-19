import { GoogleGenAI } from '@google/genai';
import { getAdminAuth, getAdminFirestore } from './_lib/firebaseAdmin.js';

// Confirmed model identifiers from @google/genai v1.52.0 SDK type definitions
// All support audio inlineData multimodal content. Ordered by performance preference.
const CANDIDATE_MODELS = [
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
];

// Vercel Serverless max body ≈ 4.5MB. Base64 inflates binary by ~33%.
// So raw audio files larger than ~3.3MB will exceed the limit.
const MAX_AUDIO_BASE64_LENGTH = 4_500_000;

// Only these origins may call this endpoint from a browser. This used to be '*' with
// no auth check at all, which let anyone on the internet spend this project's Gemini
// quota. Add a preview/staging origin here if you deploy one.
const ALLOWED_ORIGINS = [
  'https://portal.print2frame.xyz',
  'https://www.print2frame.xyz',
  'http://localhost:5173',
  'http://localhost:3000',
];

export default async function handler(req, res) {
  // CORS headers — restricted to known site origins, not '*'. Never send
  // Access-Control-Allow-Credentials with a wildcard origin.
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', true);
  }
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Require a signed-in ERP user — this endpoint spends metered Gemini API quota,
    // so it must never be reachable by an anonymous caller.
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return res.status(401).json({ error: 'Missing Authorization bearer token' });
    }
    // Resolve the Admin SDK credential BEFORE the token-verification try/catch below —
    // a missing/malformed FIREBASE_SERVICE_ACCOUNT_JSON must surface as a distinct 500
    // (server misconfigured), not get swallowed into the same generic 401 a genuinely
    // bad token produces. Conflating those two made a config problem look identical to
    // "please sign in again" from the client, which is much harder to diagnose.
    const adminAuth = getAdminAuth();

    let decodedToken;
    try {
      // checkRevoked=true so a session revoked server-side (e.g. a disabled Firebase
      // Auth account) is rejected immediately instead of staying valid until it expires.
      decodedToken = await adminAuth.verifyIdToken(idToken, true);
    } catch (authErr) {
      console.warn('generate.js: rejected invalid/expired/revoked ID token:', authErr.message);
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    }

    // A valid Firebase session alone isn't enough — the caller's ERP profile must also
    // be admin-approved and active (mirrors the client-side gate in src/App.jsx), so a
    // user who is still pending approval or was deactivated by an admin can't use this
    // endpoint just by holding a valid Firebase ID token.
    const userSnap = await getAdminFirestore().collection('users').doc(decodedToken.email).get();
    const userData = userSnap.data();
    const isApproved = userSnap.exists
      && (userData.isApproved === true || userData.status === 'Active' || userData.status === undefined);
    if (!isApproved) {
      return res.status(403).json({ error: 'Your account is pending approval or has been deactivated.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is missing on the server' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const { prompt, mimeType, audioData } = req.body || {};
    
    if (!prompt) {
      return res.status(400).json({ error: 'Missing "prompt" field in request body' });
    }

    // Validate audio payload size before sending to Gemini
    if (audioData && audioData.length > MAX_AUDIO_BASE64_LENGTH) {
      const sizeMB = (audioData.length / 1_000_000).toFixed(1);
      console.error(`Audio payload too large: ${sizeMB}MB (max ~4.5MB base64)`);
      return res.status(413).json({
        error: `Audio file is too large (${sizeMB}MB encoded). Please compress or use a shorter recording (under 3MB).`
      });
    }

    // Validate MIME type for audio payloads
    const SUPPORTED_AUDIO_TYPES = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
      'audio/aac', 'audio/flac'
    ];
    if (audioData && mimeType && !SUPPORTED_AUDIO_TYPES.includes(mimeType)) {
      console.warn(`Unsupported audio MIME type received: ${mimeType}`);
    }

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    
    if (mimeType && audioData) {
      contents[0].parts.push({
        inlineData: {
          mimeType: mimeType,
          data: audioData
        }
      });
    }

    // Try candidate models with proper error differentiation
    let lastError = null;
    let lastErrorStatus = 502;
    let responseText = null;

    for (const model of CANDIDATE_MODELS) {
      try {
        console.log(`Attempting model: ${model}`);
        const response = await ai.models.generateContent({
          model,
          contents,
        });

        if (response && response.text) {
          console.log(`Success with model: ${model}`);
          responseText = response.text;
          break;
        }
      } catch (err) {
        lastError = err;
        const errMsg = err.message || '';
        console.warn(`Model ${model} failed: ${errMsg}`);

        // If this is a data/validation error (400), don't try other models
        // — the same bad payload will fail on all of them
        if (errMsg.includes('400') || errMsg.includes('INVALID_ARGUMENT') || errMsg.includes('Bad Request')) {
          lastErrorStatus = 400;
          console.error(`Data validation error on ${model} — skipping remaining models`);
          break;
        }

        // If model is not found (404), record and try next model
        if (errMsg.includes('404') || errMsg.includes('not found') || errMsg.includes('NOT_FOUND')) {
          lastErrorStatus = 404;
          console.warn(`Model ${model} not found — trying next`);
          continue;
        }

        // For 503/429 (transient), continue to next model
        if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          lastErrorStatus = 503;
          continue;
        }

        // For other errors, record and continue
        lastErrorStatus = 502;
      }
    }

    if (responseText) {
      return res.status(200).json({ text: responseText });
    }

    // Return the REAL error with its actual status code — not a blanket 503
    const errorMsg = lastError?.message || 'All AI models failed. Please try again.';
    console.error(`All models failed [${lastErrorStatus}]: ${errorMsg}`);
    return res.status(lastErrorStatus).json({ error: errorMsg });

  } catch (err) {
    console.error('API Proxy Error:', err.message);
    res.status(502).json({ error: err.message });
  }
}

