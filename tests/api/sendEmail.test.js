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

  // Flipped in the send-email hardening (docs/03_security/AUTHORIZATION_MAP.md finding 1): free-form
  // subject and body used to be sent as given; now only fixed templates are accepted.
  it('refuses a free-form subject and body and sends nothing', async () => {
    const res = await call(await load(), { body: { to: 'a@b.co', subject: 'Hello', body: '<p>Hi</p>' } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/free-form/i);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('renders a sendable template, HTML-escaping the plain-text body', async () => {
    const res = await call(await load(), { body: { to: 'a@b.co', templateId: 'password_reset', data: { recipientName: '<script>x</script>' } } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ sent: true });
    const sent = sendMail.mock.calls[0][0];
    expect(sent.to).toBe('a@b.co');
    expect(sent.html.startsWith('<pre')).toBe(true);
    expect(sent.html).not.toMatch(/<(script|img)/i);
  });

  it('refuses a real template the app does not send through this endpoint', async () => {
    const res = await call(await load(), { body: { to: 'a@b.co', templateId: 'commission_disbursement', data: {} } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/cannot be sent/i);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('allows each of the seven templates the app sends', async () => {
    const ids = ['client_approval', 'client_activation_confirmed', 'partner_approval', 'partner_activation_confirmed', 'employee_invite', 'password_reset', 'registration_declined'];
    const handler = await load();
    for (const templateId of ids) {
      expect((await call(handler, { body: { to: 'a@b.co', templateId, data: {} } })).statusCode).toBe(200);
    }
    expect(sendMail).toHaveBeenCalledTimes(ids.length);
  });

  it('returns 502 when the SMTP credentials are missing', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_APP_PASSWORD;
    const res = await call(await load(), { body: { to: 'a@b.co', templateId: 'password_reset', data: {} } });
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toMatch(/SMTP_USER/);
  });
});

describe('api/send-email.js who may send (AUTHORIZATION_MAP finding 1)', () => {
  const body = { to: 'a@b.co', templateId: 'password_reset', data: {} };

  it.each(['Partner', 'Business Client', 'Customer'])('refuses a %s account and sends nothing', async (role) => {
    getDoc.mockResolvedValue(snap({ role, isApproved: true, status: 'Active' }));
    const res = await call(await load(), { body });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/staff/i);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('refuses an account with an unknown or missing role', async () => {
    getDoc.mockResolvedValue(snap({ isApproved: true, status: 'Active' }));
    expect((await call(await load(), { body })).statusCode).toBe(403);
    getDoc.mockResolvedValue(snap({ role: 'Superuser', isApproved: true, status: 'Active' }));
    expect((await call(await load(), { body })).statusCode).toBe(403);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it.each(['Admin', 'Manager', 'Sales', 'Operations', 'Support', 'Accounts', 'Logistics'])('allows a %s account', async (role) => {
    getDoc.mockResolvedValue(snap({ role, isApproved: true, status: 'Active' }));
    expect((await call(await load(), { body })).statusCode).toBe(200);
  });

  it('refuses a Deactivated or Disabled staff account even when isApproved is still true', async () => {
    for (const status of ['Deactivated', 'Disabled']) {
      getDoc.mockResolvedValue(snap({ role: 'Admin', isApproved: true, status }));
      expect((await call(await load(), { body })).statusCode).toBe(403);
    }
    expect(sendMail).not.toHaveBeenCalled();
  });
});
