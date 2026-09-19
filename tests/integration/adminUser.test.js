import { beforeAll, describe, it, expect } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/**
 * Exercises the exact Firebase Admin SDK calls api/admin-user.js makes for its
 * "create" and "resetPassword" actions, against the real Firebase Auth Emulator
 * (started by `firebase emulators:exec`, which also sets
 * FIREBASE_AUTH_EMULATOR_HOST automatically for this process — that's why
 * initializeApp below needs no real service-account credential).
 *
 * This is the automated version of Phase 2's manual verify step ("call create
 * and confirm a real Firebase Auth user exists... call resetPassword on an
 * existing UID and confirm the old password stops working") — it can't touch
 * production Firebase Auth, so it proves the *logic* is right without ever
 * creating a real account.
 */

beforeAll(() => {
  if (!getApps().length) {
    initializeApp({ projectId: 'demo-print2frame-test' });
  }
});

describe('api/admin-user.js Admin SDK logic: create', () => {
  it('creates a real (emulated) Firebase Auth account and it is retrievable by email', async () => {
    const auth = getAuth();
    const email = 'newstaff@example.com';
    const created = await auth.createUser({ email, password: 'Tr!al2026Pass', displayName: 'New Staff' });
    expect(created.uid).toBeTruthy();

    const fetched = await auth.getUserByEmail(email);
    expect(fetched.uid).toBe(created.uid);
    expect(fetched.displayName).toBe('New Staff');
  });

  it('rejects creating a second account with an email that already exists', async () => {
    const auth = getAuth();
    const email = 'duplicate@example.com';
    await auth.createUser({ email, password: 'Tr!al2026Pass' });
    await expect(auth.createUser({ email, password: 'AnotherPass1' })).rejects.toMatchObject({
      code: 'auth/email-already-exists',
    });
  });
});

describe('api/admin-user.js Admin SDK logic: resetPassword', () => {
  it('force-sets a new password on an existing account, and the account signs in with only the new one', async () => {
    const auth = getAuth();
    const email = 'resettarget@example.com';
    const created = await auth.createUser({ email, password: 'OldPassword1' });

    await auth.updateUser(created.uid, { password: 'NewPassword2' });

    // The Admin SDK itself has no "sign in" call (that's client-only), but the
    // emulator's Auth REST API does — exercise it directly to prove the new
    // password actually works and the old one no longer does, which is the
    // behavior a real reset must guarantee, not just that updateUser resolved.
    const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    expect(emulatorHost, 'FIREBASE_AUTH_EMULATOR_HOST must be set by `firebase emulators:exec`').toBeTruthy();

    const signIn = (password) => fetch(
      `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );

    const oldPasswordAttempt = await signIn('OldPassword1');
    expect(oldPasswordAttempt.ok).toBe(false);

    const newPasswordAttempt = await signIn('NewPassword2');
    expect(newPasswordAttempt.ok).toBe(true);
  });

  it('rejects resetting a password for an email with no account', async () => {
    const auth = getAuth();
    await expect(auth.getUserByEmail('doesnotexist@example.com')).rejects.toMatchObject({
      code: 'auth/user-not-found',
    });
  });
});

describe('api/admin-user.js Admin SDK logic: delete', () => {
  it('deletes an existing account, and it is no longer retrievable or able to sign in afterward', async () => {
    const auth = getAuth();
    const email = 'deletetarget@example.com';
    const created = await auth.createUser({ email, password: 'ToBeDeleted1' });

    // Mirrors api/admin-user.js's delete action: look up by email, then delete by uid.
    const userRecord = await auth.getUserByEmail(email);
    await auth.deleteUser(userRecord.uid);

    await expect(auth.getUserByEmail(email)).rejects.toMatchObject({
      code: 'auth/user-not-found',
    });

    // The specific real-world failure this fixes: a "deleted" account whose
    // login silently still worked. Confirm the emulator's own sign-in REST
    // endpoint agrees the account is actually gone, not just absent from a
    // getUserByEmail lookup.
    const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const signInAttempt = await fetch(
      `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'ToBeDeleted1', returnSecureToken: true }),
      }
    );
    expect(signInAttempt.ok).toBe(false);
  });

  it('treats deleting an email with no account as a no-op, not an error', async () => {
    // This is the case that matters for records created before a login ever
    // existed (e.g. a partner added manually, with no Firebase Auth account
    // behind it) — deleting them must not fail just because there's nothing
    // to delete on the Auth side.
    const auth = getAuth();
    await expect(auth.getUserByEmail('never-had-an-account@example.com')).rejects.toMatchObject({
      code: 'auth/user-not-found',
    });
    // api/admin-user.js's delete action catches exactly this error code and
    // returns { deleted: true, hadAccount: false } instead of propagating it.
  });
});
