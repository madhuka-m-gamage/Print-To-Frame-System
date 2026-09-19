import nodemailer from 'nodemailer';
import { getAdminAuth, getAdminFirestore } from './_lib/firebaseAdmin.js';
import { EMAIL_TEMPLATES, interpolateTemplate } from '../src/constants/emailTemplates.js';

// Only these origins may call this endpoint from a browser — mirrors api/generate.js.
const ALLOWED_ORIGINS = [
  'https://portal.print2frame.xyz',
  'https://www.print2frame.xyz',
  'http://localhost:5173',
  'http://localhost:3000',
];

let cachedTransporter = null;
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error('SMTP_USER / SMTP_APP_PASSWORD environment variables are missing on the server');
  }
  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  return cachedTransporter;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
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
    // Require a signed-in, approved ERP user — this endpoint can send email as the
    // company's own mailbox, so it must never be reachable by an anonymous caller
    // or it becomes an open relay. Mirrors api/generate.js's auth gate exactly.
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return res.status(401).json({ error: 'Missing Authorization bearer token' });
    }
    // Resolve the Admin SDK credential before token verification — see generate.js
    // for why a config error must not read identically to a bad token.
    const adminAuth = getAdminAuth();

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken, true);
    } catch (authErr) {
      console.warn('send-email.js: rejected invalid/expired/revoked ID token:', authErr.message);
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    }

    const userSnap = await getAdminFirestore().collection('users').doc(decodedToken.email).get();
    const userData = userSnap.data();
    const isApproved = userSnap.exists
      && (userData.isApproved === true || userData.status === 'Active' || userData.status === undefined);
    if (!isApproved) {
      return res.status(403).json({ error: 'Your account is pending approval or has been deactivated.' });
    }

    const { to, templateId, data, subject: rawSubject, body: rawBody } = req.body || {};

    if (!to || !EMAIL_RE.test(to)) {
      return res.status(400).json({ error: 'Missing or invalid "to" address' });
    }

    let subject;
    let html;

    if (templateId) {
      const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
      if (!template) {
        return res.status(400).json({ error: `Unknown templateId "${templateId}"` });
      }
      subject = interpolateTemplate(template.subject, data || {});
      // Templates are authored as plain text with line breaks; render that as HTML
      // rather than sending the literal newlines, which most mail clients collapse.
      const plainBody = interpolateTemplate(template.body, data || {});
      html = `<pre style="font-family: inherit; white-space: pre-wrap; word-wrap: break-word;">${plainBody
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</pre>`;
    } else if (rawSubject && rawBody) {
      // Pre-rendered path, for callers that already built subject/body themselves
      // (e.g. the manual EmailTemplateModal "send" action, if wired up later).
      subject = rawSubject;
      html = rawBody;
    } else {
      return res.status(400).json({ error: 'Provide either "templateId" (+ optional "data") or "subject" + "body"' });
    }

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Print To Frame" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error('send-email.js error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
