import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes } from '../helpers/mockHttp';

const verifyIdToken = vi.fn();
const getDoc = vi.fn();
const sendMail = vi.fn();

vi.mock('../../api/_lib/firebaseAdmin.js', () => ({
  getAdminAuth: () => ({ verifyIdToken }),
  getAdminFirestore: () => ({ collection: () => ({ doc: () => ({ get: getDoc }) }) }),
}));
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}));

const load = async () => (await import('../../api/send-email.js')).default;

const snap = (data) => ({ exists: data !== undefined, data: () => data });
const call = async (handler, { body, headers = { authorization: 'Bearer good' }, method = 'POST' } = {}) => {
  const { req, res } = createMockReqRes({ method, headers, body });
  await handler(req, res);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  process.env.SMTP_USER = 'sender@example.com';
  process.env.SMTP_APP_PASSWORD = 'not-a-real-password';
  verifyIdToken.mockResolvedValue({ email: 'user@example.com' });
  getDoc.mockResolvedValue(snap({ role: 'Sales', isApproved: true, status: 'Active' }));
  sendMail.mockResolvedValue({});
});

describe('api/send-email.js gate', () => {
  it('rejects a missing token with 401 and sends nothing', async () => {
    const res = await call(await load(), { headers: {}, body: { to: 'a@b.co', subject: 's', body: 'b' } });
    expect(res.statusCode).toBe(401);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rejects an invalid token with 401', async () => {
    verifyIdToken.mockRejectedValue(new Error('revoked'));
    expect((await call(await load(), { body: { to: 'a@b.co', subject: 's', body: 'b' } })).statusCode).toBe(401);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rejects an unapproved user with 403', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Sales', isApproved: false, status: 'Pending' }));
    expect((await call(await load(), { body: { to: 'a@b.co', subject: 's', body: 'b' } })).statusCode).toBe(403);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rejects GET with 405 and answers OPTIONS with 200', async () => {
    const handler = await load();
    expect((await call(handler, { method: 'GET' })).statusCode).toBe(405);
    expect((await call(handler, { method: 'OPTIONS' })).statusCode).toBe(200);
  });
});

describe('api/send-email.js payload', () => {
  it('rejects a missing or malformed "to" with 400', async () => {
    const handler = await load();
    expect((await call(handler, { body: { subject: 's', body: 'b' } })).statusCode).toBe(400);
    expect((await call(handler, { body: { to: 'nope', subject: 's', body: 'b' } })).statusCode).toBe(400);
  });

  it('rejects an unknown templateId, and a body with neither template nor subject and body', async () => {
    const handler = await load();
    expect((await call(handler, { body: { to: 'a@b.co', templateId: 'does-not-exist' } })).statusCode).toBe(400);
    expect((await call(handler, { body: { to: 'a@b.co' } })).statusCode).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends a pre-rendered subject and body through the transporter', async () => {
    const res = await call(await load(), { body: { to: 'a@b.co', subject: 'Hello', body: '<p>Hi</p>' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ sent: true });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@b.co', subject: 'Hello', html: '<p>Hi</p>' }));
  });

  it('renders a known template, HTML-escaping the plain-text body', async () => {
    const { EMAIL_TEMPLATES } = await import('../../src/constants/emailTemplates.js');
    const res = await call(await load(), { body: { to: 'a@b.co', templateId: EMAIL_TEMPLATES[0].id, data: {} } });
    expect(res.statusCode).toBe(200);
    const sent = sendMail.mock.calls[0][0];
    expect(sent.html.startsWith('<pre')).toBe(true);
    expect(sent.html).not.toMatch(/<(script|img)/i);
  });

  it('returns 502 when the SMTP credentials are missing', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_APP_PASSWORD;
    const res = await call(await load(), { body: { to: 'a@b.co', subject: 'Hello', body: 'x' } });
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toMatch(/SMTP_USER/);
  });
});
