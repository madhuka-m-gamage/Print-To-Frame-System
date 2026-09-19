/**
 * ============================================================
 * Print To Frame ERP — Production Server
 * ============================================================
 * Features:
 *   - Secure API proxy for Gemini AI (key stays server-side)
 *   - Gzip compression for text-based assets
 *   - Security headers (CSP, X-Frame-Options, etc.)
 *   - Immutable cache for hashed static assets
 *   - SPA fallback routing
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

// ── Load .env manually (avoids external dotenv dependency) ──
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let val = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}
loadEnv();

// ── Configuration ──────────────────────────────────────────
const PORT = 3000;
const DIST_DIR = path.join(__dirname, 'dist');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-3.7-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

if (!GEMINI_API_KEY) {
  console.warn('⚠️  WARNING: No GEMINI_API_KEY found in .env — AI proxy endpoints will fail.');
}

// ── MIME types ──────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.map':  'application/json',
};

// ── Compressible content types ─────────────────────────────
const COMPRESSIBLE = new Set([
  'text/html', 'text/css', 'text/javascript',
  'application/json', 'application/javascript',
  'image/svg+xml',
]);

function isCompressible(contentType) {
  const base = contentType.split(';')[0].trim();
  return COMPRESSIBLE.has(base);
}

// ── Security Headers ───────────────────────────────────────
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // CSP: Allow Google Fonts, Firebase, and Gemini API (via proxy now)
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com",
  ].join('; '));
}

// ── JSON body parser (for POST requests) ───────────────────
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ── Gemini API Proxy ───────────────────────────────────────

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function callGeminiAPI(prompt, mimeType, audioData) {
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  
  if (mimeType && audioData) {
    contents[0].parts.push({
      inlineData: {
        mimeType: mimeType,
        data: audioData
      }
    });
  }

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: contents,
  });

  if (!response.text) {
    throw new Error('No text content in Gemini response');
  }

  return response.text;
}

function sendJson(res, statusCode, data) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

async function handleApiGenerate(req, res) {
  try {
    const body = await parseJsonBody(req);
    if (!body.prompt) {
      return sendJson(res, 400, { error: 'Missing "prompt" field in request body' });
    }
    const text = await callGeminiAPI(body.prompt, body.mimeType, body.audioData);
    sendJson(res, 200, { text });
  } catch (err) {
    console.error('API Proxy Error:', err.message);
    sendJson(res, 502, { error: err.message });
  }
}

async function handleApiGenerateInvoice(req, res) {
  try {
    const body = await parseJsonBody(req);
    if (!body.prompt) {
      return sendJson(res, 400, { error: 'Missing "prompt" field in request body' });
    }
    const text = await callGeminiAPI(body.prompt, body.mimeType, body.audioData);
    sendJson(res, 200, { text });
  } catch (err) {
    console.error('API Proxy Error (Invoice):', err.message);
    sendJson(res, 502, { error: err.message });
  }
}

// ── Static File Server ─────────────────────────────────────
function serveStaticFile(req, res, filePath) {
  const extname = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  // Cache strategy
  if (filePath.includes('/assets/')) {
    // Hashed assets: cache immutably for 1 year
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (extname === '.html') {
    // HTML: never cache (ensures fresh SPA loads)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else {
    // Other files: short cache
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }

  res.setHeader('Content-Type', contentType);

  // Gzip compression for text-based assets
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (acceptEncoding.includes('gzip') && isCompressible(contentType)) {
    res.setHeader('Content-Encoding', 'gzip');
    res.writeHead(200);
    const fileStream = fs.createReadStream(filePath);
    const gzip = createGzip();
    pipeline(fileStream, gzip, res, (err) => {
      if (err) {
        console.error('Compression error:', err.message);
        // Stream already started, can't change status
      }
    });
  } else {
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Length', stat.size);
    res.writeHead(200);
    fs.createReadStream(filePath).pipe(res);
  }
}

function serveIndex(req, res) {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error: index.html not found in dist/');
    return;
  }
  serveStaticFile(req, res, indexPath);
}

// ── Request Router ─────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // Apply security headers to all responses
  setSecurityHeaders(res);

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // ── API Routes ──
  if (pathname === '/api/generate' && req.method === 'POST') {
    return handleApiGenerate(req, res);
  }
  if (pathname === '/api/generate-invoice' && req.method === 'POST') {
    return handleApiGenerateInvoice(req, res);
  }
  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'API endpoint not found' });
  }

  // ── Static Files ──
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath === '/' ? 'index.html' : safePath);

  // Prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveStaticFile(req, res, filePath);
  } else {
    // SPA fallback: serve index.html for client-side routing
    serveIndex(req, res);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║    🖼️  Print To Frame ERP — Production Server    ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  🌐 URL:    http://localhost:${PORT}/               ║`);
  console.log(`  ║  📁 Dist:   ${DIST_DIR.slice(-35).padEnd(35)}  ║`);
  console.log(`  ║  🔑 API:    ${GEMINI_API_KEY ? 'Loaded ✅' : 'MISSING ❌'}                          ║`);
  console.log('  ║  🛡️  Security headers enabled                    ║');
  console.log('  ║  📦 Gzip compression active                     ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
});
