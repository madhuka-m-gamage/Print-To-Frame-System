import { auth } from './firebase';

/**
 * ============================================================
 * Print To Frame ERP — Admin User Management Service
 * ============================================================
 * Calls the server-side /api/admin-user endpoint (Firebase Admin SDK) to
 * create a real Firebase Auth account or force-set a password on an
 * existing one. This can't be done with the client Firebase SDK: calling
 * createUserWithEmailAndPassword directly would sign the calling admin OUT
 * of their own session and INTO the newly created account.
 */
async function callAdminUserApi(payload) {
  if (!auth.currentUser) {
    throw new Error('You must be signed in to manage user accounts.');
  }
  const idToken = await auth.currentUser.getIdToken();

  const response = await fetch('/api/admin-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Invalid response from admin-user service. Status: ${response.status}. Body: ${text.substring(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(result?.error || `Admin-user service error (${response.status})`);
  }

  return result;
}

/** Creates a real Firebase Auth account with the given email/password. */
export async function createUserAccount(email, password, displayName) {
  return callAdminUserApi({ action: 'create', email, password, displayName });
}

/** Force-sets the password on an existing Firebase Auth account. */
export async function resetUserPassword(email, password) {
  return callAdminUserApi({ action: 'resetPassword', email, password });
}

/**
 * Permanently deletes the Firebase Auth account for this email, if one
 * exists — a no-op (not an error) if it doesn't. Only removes the Auth
 * account itself; callers are responsible for deleting the corresponding
 * Firestore documents (users/{email}, partners/{id}, customers/{nic}, etc.)
 * themselves, since only they know which collections are involved.
 */
export async function deleteUserAccount(email) {
  return callAdminUserApi({ action: 'delete', email });
}
