// What to do with a signed-in user who has neither a users nor a pendingUsers document.
// A registration in progress writes its own complete pending record right after the account is
// created, so the auth listener must not race it with a bare shell record or sign the user out.
export function newUserAction({ isBootstrapAdmin, registering }) {
  if (isBootstrapAdmin) return 'create_admin';
  if (registering) return 'wait_for_registration';
  return 'queue_pending';
}

// A signed-in user whose own record has been deactivated, disabled or unapproved must be signed
// out at once, not on their next login. A record without a status (legacy) stays valid.
export function shouldEvict(record) {
  if (!record) return false;
  const status = String(record.status || '').toLowerCase();
  return status === 'deactivated' || status === 'disabled' || record.isApproved === false;
}
