// What to do with a signed-in user who has neither a users nor a pendingUsers document.
// A registration in progress writes its own complete pending record right after the account is
// created, so the auth listener must not race it with a bare shell record or sign the user out.
// The rules refuse a pending request from an unverified email (SEC-15).
export function newUserAction({ isBootstrapAdmin, registering, emailVerified }) {
  if (isBootstrapAdmin) return 'create_admin';
  if (registering) return 'wait_for_registration';
  if (!emailVerified) return 'verify_email';
  return 'queue_pending';
}

// A signed-in user whose own record has been deactivated, disabled or unapproved must be signed
// out at once, not on their next login. A record without a status (legacy) stays valid.
export function shouldEvict(record) {
  if (!record) return false;
  const status = String(record.status || '').toLowerCase();
  return status === 'deactivated' || status === 'disabled' || record.isApproved === false;
}

// Whether an existing users record may start a session. A Deactivated or Disabled status wins even
// when isApproved is still true, which is what AgentDatabase's Deactivate button leaves behind.
export function canSignIn(record, isBootstrapAdmin) {
  if (isBootstrapAdmin) return true;
  if (!record || shouldEvict(record)) return false;
  return Boolean(record.isApproved) || record.status === 'Active' || record.status === undefined;
}
