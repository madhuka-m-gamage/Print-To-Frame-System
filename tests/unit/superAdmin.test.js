import { describe, it, expect } from 'vitest';
import { isSuperAdminEmail, canUseGoogleWorkspace, assertGoogleWorkspaceAllowed } from '@/features/auth/superAdmin';

describe('isSuperAdminEmail', () => {
  it('recognises the two bootstrap super admin emails, ignoring case and spaces', () => {
    expect(isSuperAdminEmail('madhukagamage6@gmail.com')).toBe(true);
    expect(isSuperAdminEmail(' MadhukaGamage@gmail.com ')).toBe(true);
  });

  it('rejects anyone else, including a missing email', () => {
    expect(isSuperAdminEmail('admin@example.com')).toBe(false);
    expect(isSuperAdminEmail(undefined)).toBe(false);
  });
});

describe('Google Drive and Contacts access (DEC-8)', () => {
  it('is offered only to a super admin, whatever their role', () => {
    expect(canUseGoogleWorkspace({ role: 'Admin', identifier: 'madhukagamage6@gmail.com' })).toBe(true);
    expect(canUseGoogleWorkspace({ role: 'Admin', identifier: 'admin@example.com' })).toBe(false);
    expect(canUseGoogleWorkspace(null)).toBe(false);
  });

  it('refuses the Google token request for anyone else', () => {
    expect(() => assertGoogleWorkspaceAllowed('madhukagamage@gmail.com')).not.toThrow();
    expect(() => assertGoogleWorkspaceAllowed('sales@example.com')).toThrow('Google Drive and Contacts are available to the super admin only.');
  });
});
