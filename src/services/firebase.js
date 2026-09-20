/**
 * ============================================================
 * Print To Frame ERP — Firebase Service
 * ============================================================
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, addDoc, getDocs, updateDoc, doc, deleteDoc, getDocFromServer } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

import fallbackConfig from '../../firebase-applet-config.json';

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackConfig.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN !== 'print-to-frame-erp.firebaseapp.com')
    ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
    : (fallbackConfig.authDomain || 'auth.print2frame.xyz'),
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || fallbackConfig.firestoreDatabaseId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  oAuthClientId: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID || fallbackConfig.oAuthClientId
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const getDatabaseInstance = () => {
  const dbId = firebaseConfig.firestoreDatabaseId;
  if (!dbId || dbId === '(default)' || dbId.trim() === '') {
    return getFirestore(app);
  }
  return getFirestore(app, dbId);
};

export const db = getDatabaseInstance();
export const auth = getAuth(app);
export const storage = getStorage(app);

// Test-only: point every Firebase client at the local emulators. Fails closed: it needs the
// explicit flag AND either the dev server or a demo- project id, so a production build with a
// real project id can never attach to (or be silently redirected to) an emulator.
if (
  import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' &&
  (import.meta.env.DEV || String(firebaseConfig.projectId).startsWith('demo-'))
) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  console.warn(
    `[firebase] USING EMULATORS for project "${firebaseConfig.projectId}": firestore 127.0.0.1:8080, auth 127.0.0.1:9099, storage 127.0.0.1:9199. Production Firebase is NOT in use.`
  );
}

// Google Auth Provider (Standard Identity Scopes)
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');

let isSigningIn = false;
let cachedAccessToken = null;

export const initAuth = (onAuthSuccess, onAuthFailure) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async () => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    if (cachedAccessToken && typeof window !== 'undefined') {
      sessionStorage.setItem('ptf_google_access_token', cachedAccessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async () => {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('ptf_google_access_token');
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  }
  return null;
};

// Drive and Contacts scopes are requested on demand, not at sign-in, so customers and partners
// are never asked for them. Google access tokens last an hour and Firebase does not refresh
// them, so each is cached with an expiry a little short of that.
const SCOPED_TOKEN_PREFIX = 'ptf_google_token:';
const SCOPED_TOKEN_TTL_MS = 55 * 60 * 1000;

const readScopedToken = (scope) => {
  try {
    const stored = JSON.parse(sessionStorage.getItem(SCOPED_TOKEN_PREFIX + scope) || 'null');
    return stored && stored.expiresAt > Date.now() ? stored.token : null;
  } catch {
    return null;
  }
};

export const getScopedAccessToken = async (scope) => {
  const cached = readScopedToken(scope);
  if (cached) return cached;

  const scopedProvider = new GoogleAuthProvider();
  scopedProvider.addScope(scope);
  if (auth.currentUser?.email) scopedProvider.setCustomParameters({ login_hint: auth.currentUser.email });
  const result = await signInWithPopup(auth, scopedProvider);
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken || null;
  if (!token) throw new Error('Google did not grant access. Please try again.');
  try {
    sessionStorage.setItem(SCOPED_TOKEN_PREFIX + scope, JSON.stringify({ token, expiresAt: Date.now() + SCOPED_TOKEN_TTL_MS }));
  } catch { /* storage unavailable: the token still works for this call */ }
  return token;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('ptf_google_access_token');
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(SCOPED_TOKEN_PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  }
};

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

export function handleFirestoreError(error, operationType, path = null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export const testConnection = async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore connecting...");
    }
  }
};
testConnection();

export const emailLogin = async (email, password) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const emailRegister = async (email, password) => {
  return await createUserWithEmailAndPassword(auth, email, password);
};

