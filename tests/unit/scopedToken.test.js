import { describe, it, expect, vi, beforeEach } from 'vitest';

const signInWithPopup = vi.fn();
const addScope = vi.fn();
const setCustomParameters = vi.fn();
const credentialFromResult = vi.fn();
const auth = { currentUser: { email: 'a@b.co' } };

vi.mock('firebase/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(), connectFirestoreEmulator: vi.fn(), collection: vi.fn(), addDoc: vi.fn(),
  getDocs: vi.fn(), updateDoc: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), getDocFromServer: vi.fn(),
}));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(), connectStorageEmulator: vi.fn() }));
vi.mock('firebase/auth', () => {
  class GoogleAuthProvider {
    addScope(s) { addScope(s); }
    setCustomParameters(p) { setCustomParameters(p); }
    static credentialFromResult(r) { return credentialFromResult(r); }
  }
  return {
    getAuth: () => auth, connectAuthEmulator: vi.fn(), signInWithPopup, GoogleAuthProvider,
    onAuthStateChanged: vi.fn(), signInWithEmailAndPassword: vi.fn(), createUserWithEmailAndPassword: vi.fn(),
  };
});

const store = {};
vi.stubGlobal('window', {});
vi.stubGlobal('sessionStorage', {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
});

const { getScopedAccessToken } = await import('@/services/firebase');

const DRIVE = 'https://www.googleapis.com/auth/drive.readonly';

describe('getScopedAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(store).forEach((k) => delete store[k]);
    signInWithPopup.mockResolvedValue({});
    credentialFromResult.mockReturnValue({ accessToken: 'tok-1' });
  });

  it('asks Google for the one scope, hinting the signed-in email, and caches the token', async () => {
    expect(await getScopedAccessToken(DRIVE)).toBe('tok-1');
    expect(addScope).toHaveBeenCalledWith(DRIVE);
    expect(setCustomParameters).toHaveBeenCalledWith({ login_hint: 'a@b.co' });

    expect(await getScopedAccessToken(DRIVE)).toBe('tok-1');
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
  });

  it('asks again once the cached token has expired', async () => {
    await getScopedAccessToken(DRIVE);
    const key = Object.keys(store).find((k) => k.startsWith('ptf_google_token:'));
    store[key] = JSON.stringify({ token: 'old', expiresAt: Date.now() - 1 });
    credentialFromResult.mockReturnValue({ accessToken: 'tok-2' });

    expect(await getScopedAccessToken(DRIVE)).toBe('tok-2');
    expect(signInWithPopup).toHaveBeenCalledTimes(2);
  });

  it('keeps a separate token per scope', async () => {
    await getScopedAccessToken(DRIVE);
    credentialFromResult.mockReturnValue({ accessToken: 'tok-c' });
    expect(await getScopedAccessToken('https://www.googleapis.com/auth/contacts.readonly')).toBe('tok-c');
    expect(signInWithPopup).toHaveBeenCalledTimes(2);
  });

  it('throws when Google returns no token, and lets a blocked popup error through', async () => {
    credentialFromResult.mockReturnValue(null);
    await expect(getScopedAccessToken(DRIVE)).rejects.toThrow(/did not grant access/);
    signInWithPopup.mockRejectedValue(new Error('popup-blocked'));
    await expect(getScopedAccessToken(DRIVE)).rejects.toThrow('popup-blocked');
  });
});
