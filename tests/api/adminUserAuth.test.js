import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes } from '../helpers/mockHttp';

const verifyIdToken = vi.fn();
const getDoc = vi.fn();

vi.mock('../../api/_lib/firebaseAdmin.js', () => ({
  getAdminAuth: () => ({ verifyIdToken }),
  getAdminFirestore: () => ({ collection: () => ({ doc: () => ({ get: getDoc }) }) }),
}));

const { default: handler } = await import('../../api/admin-user.js');

const snap = (data) => ({ exists: data !== undefined, data: () => data });
const call = async (body = { action: 'create' }) => {
  const { req, res } = createMockReqRes({ method: 'POST', headers: { authorization: 'Bearer good-token' }, body });
  await handler(req, res);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  verifyIdToken.mockResolvedValue({ email: 'caller@example.com' });
});

describe('api/admin-user.js caller checks', () => {
  it('rejects an invalid or revoked token with 401', async () => {
    verifyIdToken.mockRejectedValue(new Error('token revoked'));
    const res = await call();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired/i);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('rejects a caller with no users document with 403', async () => {
    getDoc.mockResolvedValue(snap(undefined));
    expect((await call()).statusCode).toBe(403);
  });

  it('rejects a pending caller (not approved, not Active) with 403', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Admin', isApproved: false, status: 'Pending' }));
    expect((await call()).statusCode).toBe(403);
  });

  it('rejects a non-Admin approved caller with 403', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Sales', isApproved: true, status: 'Active' }));
    const res = await call();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/only admins/i);
  });

  // Characterisation: docs/02_modules/user-management-rbac/FINDINGS.md finding 1
  // (deactivated user with isApproved true still passes). The gate treats
  // isApproved === true as enough and never reads status 'Deactivated'. The
  // request gets past the auth checks and fails later on validation (400).
  // Flips to 403 in Phase 7 prompt 3.6.
  it('lets a Deactivated caller with isApproved true through the approval gate', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Admin', isApproved: true, status: 'Deactivated' }));
    const res = await call({ action: 'create' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  // Characterisation: docs/02_modules/employees/FINDINGS.md D4 (Managers may
  // administer users, owner decision). Today only Admin passes the role check.
  // Flips in Phase 7 prompt 3.6.
  it('rejects a Manager caller today because only Admin is allowed', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Manager', isApproved: true, status: 'Active' }));
    const res = await call({ action: 'create', email: 'new@example.com', password: 'secret1' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/only admins/i);
  });

  it('lets an approved Admin through and validates the payload', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Admin', isApproved: true, status: 'Active' }));
    expect((await call({ action: 'create', email: 'not-an-email', password: 'secret1' })).statusCode).toBe(400);
    expect((await call({ action: 'create', email: 'a@b.co', password: '123' })).statusCode).toBe(400);
    expect((await call({ action: 'nope', email: 'a@b.co' })).statusCode).toBe(400);
  });
});
