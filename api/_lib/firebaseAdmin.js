import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Parses FIREBASE_SERVICE_ACCOUNT_JSON into a service-account object.
 *
 * Accepts EITHER a raw JSON string OR a base64-encoded one, auto-detected by
 * whether the trimmed value starts with "{". Base64 is the recommended format
 * for anyone setting this fresh — a JSON blob contains quotes and newlines
 * that need careful escaping to survive a .env file, a shell `export`, and
 * Vercel's dashboard all agreeing on the same encoding, and getting that
 * escaping wrong (e.g. double-encoding it) fails in a way that's easy to
 * misdiagnose as "the credential is wrong" rather than "the encoding is
 * wrong". Base64 output is plain alphanumerics plus +/=, so none of that
 * ambiguity exists. Raw JSON is still accepted so whatever is already
 * configured for this variable does not need to be re-entered.
 */
export function parseServiceAccountJson(raw) {
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is missing on the server');
  }
  const trimmed = raw.trim();
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : Buffer.from(trimmed, 'base64').toString('utf8');
  try {
    return JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON could not be parsed as JSON (tried ${trimmed.startsWith('{') ? 'raw JSON' : 'base64-decoded'} form): ${err.message}`);
  }
}

export function ensureAdminApp() {
  if (!getApps().length) {
    const serviceAccount = parseServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    initializeApp({ credential: cert(serviceAccount) });
  }
}

export function getAdminAuth() {
  ensureAdminApp();
  return getAuth();
}

export function getAdminFirestore() {
  ensureAdminApp();
  return getFirestore();
}
