import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes } from '../helpers/mockHttp';

const verifyIdToken = vi.fn();
const getDoc = vi.fn();
const createUser = vi.fn();
const updateUser = vi.fn();
const collectionDoc = vi.fn(() => ({ get: getDoc }));

vi.mock('../../api/_lib/firebaseAdmin.js', () => ({
  getAdminAuth: () => ({ verifyIdToken, createUser, updateUser, getUserByEmail: vi.fn(async () => ({ uid: 'u1' })) }),
  getAdminFirestore: () => ({ collection: () => ({ doc: (...args) => collectionDoc(...args) }) }),
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
  createUser.mockResolvedValue({ uid: 'u-new' });
  collectionDoc.mockImplementation(() => ({ get: getDoc }));
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

  // Flipped in Phase 7 3.6 (user-management-rbac finding 1): a Deactivated caller is
  // rejected even when isApproved is still true.
  it('rejects a Deactivated caller even with isApproved true', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Admin', isApproved: true, status: 'Deactivated' }));
    const res = await call({ action: 'create', email: 'new@example.com', password: 'secret1' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/deactivated/i);
  });

  it('rejects a Disabled caller and treats status case-insensitively', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Admin', isApproved: true, status: 'disabled' }));
    expect((await call()).statusCode).toBe(403);
  });

  it('looks the caller up by the trimmed, lowercased token email', async () => {
    verifyIdToken.mockResolvedValue({ email: '  Caller@Example.com ' });
    getDoc.mockResolvedValue(snap({ role: 'Admin', isApproved: true, status: 'Active' }));
    const doc = vi.fn(() => ({ get: getDoc }));
    collectionDoc.mockImplementation(doc);
    await call({ action: 'create' });
    expect(doc).toHaveBeenCalledWith('caller@example.com');
  });

  // Flipped in Phase 7 3.6 (employees D4): Managers may administer users, but not Admins.
  it('lets a Manager manage a non-Admin user', async () => {
    getDoc
      .mockResolvedValueOnce(snap({ role: 'Manager', isApproved: true, status: 'Active' }))
      .mockResolvedValueOnce(snap({ role: 'Sales', isApproved: true, status: 'Active' }));
    const res = await call({ action: 'create', email: 'new@example.com', password: 'secret1' });
    expect(res.statusCode).not.toBe(403);
    expect(createUser).toHaveBeenCalled();
  });

  it('stops a Manager from acting on an Admin account', async () => {
    getDoc
      .mockResolvedValueOnce(snap({ role: 'Manager', isApproved: true, status: 'Active' }))
      .mockResolvedValueOnce(snap({ role: 'Admin', isApproved: true, status: 'Active' }));
    const res = await call({ action: 'resetPassword', email: 'boss@example.com', password: 'secret1' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Admin accounts/);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('stops a Manager from granting Admin', async () => {
    getDoc
      .mockResolvedValueOnce(snap({ role: 'Manager', isApproved: true, status: 'Active' }))
      .mockResolvedValueOnce(snap(undefined));
    const res = await call({ action: 'create', email: 'new@example.com', password: 'secret1', role: 'Admin' });
    expect(res.statusCode).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rejects Sales callers with 403', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Sales', isApproved: true, status: 'Active' }));
    expect((await call({ action: 'create', email: 'a@b.co', password: 'secret1' })).statusCode).toBe(403);
  });

  it('lets an approved Admin through and validates the payload', async () => {
    getDoc.mockResolvedValue(snap({ role: 'Admin', isApproved: true, status: 'Active' }));
    expect((await call({ action: 'create', email: 'not-an-email', password: 'secret1' })).statusCode).toBe(400);
    expect((await call({ action: 'create', email: 'a@b.co', password: '123' })).statusCode).toBe(400);
    expect((await call({ action: 'nope', email: 'a@b.co' })).statusCode).toBe(400);
  });
});
