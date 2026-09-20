import { describe, it, expect } from 'vitest';
import handler from '../../api/admin-user.js';
import { createMockReqRes } from '../helpers/mockHttp';

// Both cases return before api/_lib/firebaseAdmin.js is reached, so no Firebase mock is needed.
describe('api/admin-user.js gate', () => {
  it('rejects a GET with 405', async () => {
    const { req, res } = createMockReqRes({ method: 'GET' });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });

  it('rejects a POST without an Authorization header with 401', async () => {
    const { req, res } = createMockReqRes({ method: 'POST', body: { action: 'create' } });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/bearer token/i);
  });

  it('echoes an allowed origin and never a wildcard', async () => {
    const { req, res } = createMockReqRes({ method: 'GET', origin: 'https://portal.print2frame.xyz' });
    await handler(req, res);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://portal.print2frame.xyz');
  });
});
