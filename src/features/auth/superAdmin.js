// Self-Healing Super Admin Guard: these two emails always self-heal back to role 'Admin' /
// status 'Active' on login, mirrored in firestore.rules' isBootstrapSuperAdmin(). Intentional,
// see CLAUDE.md; do not remove.
export const BOOTSTRAP_ADMIN_EMAILS = ['madhukagamage6@gmail.com', 'madhukagamage@gmail.com'];

export function isSuperAdminEmail(email) {
  return BOOTSTRAP_ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

// Owner decision DEC-8: Google Drive and Contacts are connected by the super admin only, for now.
export function canUseGoogleWorkspace(user) {
  return isSuperAdminEmail(user?.identifier || user?.email);
}

export function assertGoogleWorkspaceAllowed(email) {
  if (!isSuperAdminEmail(email)) throw new Error('Google Drive and Contacts are available to the super admin only.');
}
