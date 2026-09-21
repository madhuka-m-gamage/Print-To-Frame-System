import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes } from '../helpers/mockHttp';

const verifyIdToken = vi.fn();
const getDoc = vi.fn();
const generateContent = vi.fn();

vi.mock('../../api/_lib/firebaseAdmin.js', () => ({
  getAdminAuth: () => ({ verifyIdToken }),
  getAdminFirestore: () => ({ collection: () => ({ doc: () => ({ get: getDoc }) }) }),
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { constructor() { this.models = { generateContent }; } },
}));

const { default: handler } = await import('../../api/generate.js');

const snap = (data) => ({ exists: data !== undefined, data: () => data });
const call = async ({ body = { prompt: 'hi' }, headers = { authorization: 'Bearer good' }, origin, method = 'POST' } = {}) => {
  const { req, res } = createMockReqRes({ method, headers, body, origin });
  await handler(req, res);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  process.env.GEMINI_API_KEY = 'test-key';
  verifyIdToken.mockResolvedValue({ email: 'user@example.com' });
  getDoc.mockResolvedValue(snap({ role: 'Sales', isApproved: true, status: 'Active' }));
});

describe('api/generate.js gate', () => {
  it('rejects a missing bearer token with 401 before touching Firebase', async () => {
    const res = await call({ headers: {} });
    expect(res.statusCode).toBe(401);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects an invalid token with 401', async () => {
    verifyIdToken.mockRejectedValue(new Error('expired'));
    expect((await call()).statusCode).toBe(401);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('rejects an unapproved user with 403 and never calls Gemini', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Sales', isApproved: false, status: 'Pending' }));
    expect((await call()).statusCode).toBe(403);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('rejects a user with no profile with 403', async () => {
    getDoc.mockResolvedValue(snap(undefined));
    expect((await call()).statusCode).toBe(403);
  });

  it('answers OPTIONS with 200 and rejects other methods with 405', async () => {
    expect((await call({ method: 'OPTIONS' })).statusCode).toBe(200);
    expect((await call({ method: 'GET' })).statusCode).toBe(405);
  });

  it('echoes only allowed origins and never a wildcard', async () => {
    const ok = await call({ origin: 'https://portal.print2frame.xyz' });
    expect(ok.headers['Access-Control-Allow-Origin']).toBe('https://portal.print2frame.xyz');
    const bad = await call({ origin: 'https://evil.example.com' });
    expect(bad.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('returns 500 when the Gemini key is missing and 400 when the prompt is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.VITE_GEMINI_API_KEY;
    expect((await call()).statusCode).toBe(500);
    process.env.GEMINI_API_KEY = 'test-key';
    expect((await call({ body: {} })).statusCode).toBe(400);
  });

  it('rejects an oversized audio payload with 413', async () => {
    const res = await call({ body: { prompt: 'x', mimeType: 'audio/mpeg', audioData: 'a'.repeat(4_500_001) } });
    expect(res.statusCode).toBe(413);
    expect(generateContent).not.toHaveBeenCalled();
  });
});

describe('api/generate.js model fallback', () => {
  it('returns the text from the first model that answers', async () => {
    generateContent.mockResolvedValueOnce({ text: 'hello' });
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ text: 'hello' });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['404 not found', '404 model not found'],
    ['503 unavailable', '503 UNAVAILABLE'],
    ['429 quota', '429 RESOURCE_EXHAUSTED'],
  ])('falls through to the next model on %s', async (_label, message) => {
    generateContent.mockRejectedValueOnce(new Error(message)).mockResolvedValueOnce({ text: 'second' });
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body.text).toBe('second');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('stops immediately on a 400 and returns it', async () => {
    generateContent.mockRejectedValue(new Error('400 INVALID_ARGUMENT bad payload'));
    const res = await call();
    expect(res.statusCode).toBe(400);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('tries every candidate and returns 503 when all are unavailable', async () => {
    generateContent.mockRejectedValue(new Error('503 UNAVAILABLE'));
    const res = await call();
    expect(res.statusCode).toBe(503);
    expect(generateContent).toHaveBeenCalledTimes(5);
  });
});
