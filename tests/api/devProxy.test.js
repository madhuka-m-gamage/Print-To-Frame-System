import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';

const verifyIdToken = vi.fn();
const getDoc = vi.fn();
const createUser = vi.fn();
const generateContent = vi.fn();
const sendMail = vi.fn();

vi.mock('../../api/_lib/firebaseAdmin.js', () => ({
  getAdminAuth: () => ({ verifyIdToken, createUser }),
  getAdminFirestore: () => ({ collection: () => ({ doc: () => ({ get: getDoc }) }) }),
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { constructor() { this.models = { generateContent }; } },
}));
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}));

const { default: viteConfig } = await import('../../vite.config.js');

let middleware;
viteConfig.plugins.flat()
  .find((p) => p?.name === 'api-proxy-plugin')
  .configureServer({ middlewares: { use: (fn) => { middleware = fn; } } });

const snap = (data) => ({ exists: data !== undefined, data: () => data });

function request({ url, method = 'POST', headers = {}, body }) {
  const raw = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const req = Readable.from(raw ? [raw] : []);
  Object.assign(req, { url, method, headers: { 'content-type': 'application/json', ...headers } });
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { res.headers[name.toLowerCase()] = value; },
      end(payload) { resolve({ status: res.statusCode, body: payload ? JSON.parse(payload) : undefined, next: false }); },
    };
    middleware(req, res, () => resolve({ next: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}';
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.SMTP_USER = 'mailer@example.com';
  process.env.SMTP_APP_PASSWORD = 'app-password';
  verifyIdToken.mockResolvedValue({ email: 'caller@example.com' });
  createUser.mockResolvedValue({ uid: 'new-uid' });
  generateContent.mockResolvedValue({ text: 'ok' });
});

describe('dev server binding', () => {
  it('listens on localhost only, not every interface', () => {
    expect(viteConfig.server.host).toBe('127.0.0.1');
    expect(viteConfig.server.allowedHosts).toBeUndefined();
  });

  it('no npm script overrides the host with 0.0.0.0', () => {
    const { scripts } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    for (const name of ['dev', 'dev:emulated', 'preview']) {
      expect(scripts[name]).not.toMatch(/--host/);
    }
  });
});

describe('dev proxy runs the real api/*.js handlers', () => {
  it('admin-user: refuses a request with no bearer token and creates no account', async () => {
    const res = await request({ url: '/api/admin-user', body: { action: 'create', email: 'x@example.com', password: 'secret1' } });
    expect(res.status).toBe(401);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('admin-user: refuses a signed-in non-admin role', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Sales', isApproved: true, status: 'Active' }));
    const res = await request({
      url: '/api/admin-user',
      headers: { authorization: 'Bearer good' },
      body: { action: 'create', email: 'x@example.com', password: 'secret1' },
    });
    expect(res.status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('admin-user: lets an Admin create an account', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Admin', isApproved: true, status: 'Active' }));
    const res = await request({
      url: '/api/admin-user',
      headers: { authorization: 'Bearer good' },
      body: { action: 'create', email: 'x@example.com', password: 'secret1' },
    });
    expect(res).toMatchObject({ status: 200, body: { created: true, uid: 'new-uid' } });
    expect(createUser).toHaveBeenCalledTimes(1);
  });

  it('generate: refuses an external role without calling Gemini', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Partner', isApproved: true, status: 'Active' }));
    const res = await request({ url: '/api/generate', headers: { authorization: 'Bearer good' }, body: { prompt: 'hi' } });
    expect(res.status).toBe(403);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('send-email: refuses a request with no bearer token and sends nothing', async () => {
    const res = await request({ url: '/api/send-email', body: { to: 'x@example.com', subject: 's', body: 'b' } });
    expect(res.status).toBe(401);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('answers malformed JSON with 400', async () => {
    const res = await request({ url: '/api/admin-user', headers: { authorization: 'Bearer good' }, body: '{not json' });
    expect(res.status).toBe(400);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('passes other requests on to Vite', async () => {
    expect(await request({ url: '/src/main.jsx', method: 'GET' })).toEqual({ next: true });
  });
});
