import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { GoogleGenAI } from '@google/genai'
import nodemailer from 'nodemailer'
import { EMAIL_TEMPLATES, interpolateTemplate } from './src/constants/emailTemplates.js'
import { getAdminAuth } from './api/_lib/firebaseAdmin.js'

function apiProxyPlugin() {
  return {
    name: 'api-proxy-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/admin-user' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT_JSON is not configured in .env — this endpoint needs real Admin SDK credentials even in dev, since it creates/modifies real Firebase Auth accounts.' }));
                return;
              }
              const adminAuth = getAdminAuth();

              const { action, email, password, displayName } = body ? JSON.parse(body) : {};
              if (!email) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing "email"' }));
                return;
              }
              if ((action === 'create' || action === 'resetPassword') && (!password || password.length < 6)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Password must be at least 6 characters' }));
                return;
              }
              const normalizedEmail = email.trim().toLowerCase();

              // Dev convenience only: unlike production (api/admin-user.js), this
              // skips ID-token verification and the Admin-role check. Anyone who
              // can reach your local dev server can call this — do not expose
              // `npm run dev` beyond localhost.
              if (action === 'create') {
                const userRecord = await adminAuth.createUser({ email: normalizedEmail, password, displayName: displayName || undefined });
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ created: true, uid: userRecord.uid }));
                return;
              }
              if (action === 'resetPassword') {
                const userRecord = await adminAuth.getUserByEmail(normalizedEmail);
                await adminAuth.updateUser(userRecord.uid, { password });
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ reset: true, uid: userRecord.uid }));
                return;
              }
              if (action === 'delete') {
                try {
                  const userRecord = await adminAuth.getUserByEmail(normalizedEmail);
                  await adminAuth.deleteUser(userRecord.uid);
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ deleted: true, hadAccount: true }));
                } catch (lookupErr) {
                  if (lookupErr.code === 'auth/user-not-found') {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ deleted: true, hadAccount: false }));
                    return;
                  }
                  throw lookupErr;
                }
                return;
              }
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Unknown "action" — expected "create", "resetPassword", or "delete"' }));
            } catch (err) {
              console.error('Dev admin-user proxy error:', err.message);
              res.statusCode = err.code === 'auth/email-already-exists' ? 409
                : err.code === 'auth/user-not-found' ? 404
                : 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
        if (req.url === '/api/send-email' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const parsed = body ? JSON.parse(body) : {};
              const user = process.env.SMTP_USER;
              const pass = process.env.SMTP_APP_PASSWORD;
              if (!user || !pass) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'SMTP_USER / SMTP_APP_PASSWORD are not configured in .env.local' }));
                return;
              }
              const { to, templateId, data, subject: rawSubject, body: rawBody } = parsed;
              if (!to) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing "to" address' }));
                return;
              }
              let subject, html;
              if (templateId) {
                const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
                if (!template) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: `Unknown templateId "${templateId}"` }));
                  return;
                }
                subject = interpolateTemplate(template.subject, data || {});
                const plainBody = interpolateTemplate(template.body, data || {});
                html = `<pre style="font-family: inherit; white-space: pre-wrap; word-wrap: break-word;">${plainBody
                  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
              } else if (rawSubject && rawBody) {
                subject = rawSubject;
                html = rawBody;
              } else {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Provide either "templateId" (+ optional "data") or "subject" + "body"' }));
                return;
              }
              const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass },
              });
              await transporter.sendMail({ from: `"Print To Frame" <${user}>`, to, subject, html });
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ sent: true }));
            } catch (err) {
              console.error('Dev mail proxy error:', err.message);
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
        if ((req.url === '/api/generate' || req.url === '/api/generate-invoice') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const parsed = body ? JSON.parse(body) : {};
              const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
              if (!apiKey) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'GEMINI_API_KEY environment variable is not configured' }));
                return;
              }

              const ai = new GoogleGenAI({ apiKey });
              const { prompt, mimeType, audioData } = parsed;

              if (!prompt) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing "prompt" field in request body' }));
                return;
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

              const response = await ai.models.generateContent({
                model: 'gemini-3.7-flash',
                contents,
              });

              if (!response.text) {
                throw new Error('No text content in Gemini response');
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ text: response.text }));
            } catch (err) {
              console.error('API Proxy Error:', err.message);
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiProxyPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors out of the entry chunk. The big wins are docx and
        // recharts (used by only a couple of routes); lucide-react is imported
        // icon-by-icon everywhere, so its chunk buys cache stability rather
        // than a smaller initial download.
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage',
          ],
          'vendor-sentry': ['@sentry/react'],
          'vendor-charts': ['recharts'],
          'vendor-docx': ['docx'],
          'vendor-genai': ['@google/genai'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})

