import { getAdminAuth, getAdminFirestore } from './_lib/firebaseAdmin.js';

// Only these origins may call this endpoint from a browser — mirrors api/generate.js
// and api/send-email.js.
const ALLOWED_ORIGINS = [
  'https://portal.print2frame.xyz',
  'https://www.print2frame.xyz',
  'http://localhost:5173',
  'http://localhost:3000',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', true);
  }
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Require a signed-in, approved, ADMIN ERP user. This endpoint can create a
    // Firebase Auth account with a caller-supplied password, or force-set the
    // password on an existing one — strictly more dangerous than api/generate.js
    // or api/send-email.js, so it needs a role check on top of their shared gate.
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return res.status(401).json({ error: 'Missing Authorization bearer token' });
    }
    // Resolve the Admin SDK credential before token verification — see generate.js
    // for why a config error must not read identically to a bad token.
    const adminAuth = getAdminAuth();

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken, true);
    } catch (authErr) {
      console.warn('admin-user.js: rejected invalid/expired/revoked ID token:', authErr.message);
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    }

    const callerSnap = await getAdminFirestore().collection('users').doc(decodedToken.email).get();
    const callerData = callerSnap.data();
    const isApproved = callerSnap.exists
      && (callerData.isApproved === true || callerData.status === 'Active' || callerData.status === undefined);
    if (!isApproved) {
      return res.status(403).json({ error: 'Your account is pending approval or has been deactivated.' });
    }
    if (callerData.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Admins can manage user credentials.' });
    }

    const { action, email, password, displayName } = req.body || {};

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Missing or invalid "email"' });
    }
    if ((action === 'create' || action === 'resetPassword') && (!password || password.length < 6)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (action === 'create') {
      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email: normalizedEmail,
          password,
          displayName: displayName || undefined,
        });
      } catch (createErr) {
        if (createErr.code === 'auth/email-already-exists') {
          return res.status(409).json({
            error: `A Firebase Auth account already exists for ${normalizedEmail}. Use "resetPassword" instead if you need to change its password.`,
          });
        }
        throw createErr;
      }
      return res.status(200).json({ created: true, uid: userRecord.uid });
    }

    if (action === 'resetPassword') {
      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(normalizedEmail);
      } catch (lookupErr) {
        if (lookupErr.code === 'auth/user-not-found') {
          return res.status(404).json({
            error: `No Firebase Auth account exists for ${normalizedEmail} yet. Use "create" first.`,
          });
        }
        throw lookupErr;
      }
      await adminAuth.updateUser(userRecord.uid, { password });
      return res.status(200).json({ reset: true, uid: userRecord.uid });
    }

    if (action === 'delete') {
      // Deleting an "account" here always means the Firebase Auth account only —
      // callers are responsible for deleting the corresponding users/{email} (and
      // partners/customers, etc.) Firestore documents themselves. Not every caller
      // of this action has a real Auth account behind it (e.g. a partner added
      // manually with no login ever granted), so a missing account is treated as
      // an already-satisfied delete, not an error.
      try {
        const userRecord = await adminAuth.getUserByEmail(normalizedEmail);
        await adminAuth.deleteUser(userRecord.uid);
        return res.status(200).json({ deleted: true, hadAccount: true });
      } catch (lookupErr) {
        if (lookupErr.code === 'auth/user-not-found') {
          return res.status(200).json({ deleted: true, hadAccount: false });
        }
        throw lookupErr;
      }
    }

    return res.status(400).json({ error: 'Unknown "action" — expected "create", "resetPassword", or "delete"' });
  } catch (err) {
    console.error('admin-user.js error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
