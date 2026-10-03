import { describe, it, expect } from 'vitest';
import { newUserAction, shouldEvict, canSignIn } from '@/features/auth/authFlow';

describe('newUserAction', () => {
  it('always creates the record for a bootstrap admin', () => {
    expect(newUserAction({ isBootstrapAdmin: true, registering: false })).toBe('create_admin');
    expect(newUserAction({ isBootstrapAdmin: true, registering: true })).toBe('create_admin');
    expect(newUserAction({ isBootstrapAdmin: true, registering: false, emailVerified: false })).toBe('create_admin');
  });

  it('leaves a sign-up in progress alone instead of racing it with a shell record', () => {
    expect(newUserAction({ isBootstrapAdmin: false, registering: true })).toBe('wait_for_registration');
  });

  it('queues a verified first-time sign-in for approval', () => {
    expect(newUserAction({ isBootstrapAdmin: false, registering: false, emailVerified: true })).toBe('queue_pending');
  });

  // SEC-15: the rules refuse a pending request from an unverified email.
  it('asks an unverified first-time sign-in to verify the email first', () => {
    expect(newUserAction({ isBootstrapAdmin: false, registering: false, emailVerified: false })).toBe('verify_email');
    expect(newUserAction({ isBootstrapAdmin: false, registering: false })).toBe('verify_email');
  });
});

describe('shouldEvict', () => {
  it('evicts a deactivated, disabled or unapproved account, whatever the casing', () => {
    expect(shouldEvict({ status: 'Deactivated' })).toBe(true);
    expect(shouldEvict({ status: 'disabled' })).toBe(true);
    expect(shouldEvict({ status: 'Active', isApproved: false })).toBe(true);
  });

  it('keeps active accounts, legacy records with no status, and a missing record', () => {
    expect(shouldEvict({ status: 'Active', isApproved: true })).toBe(false);
    expect(shouldEvict({ isApproved: true })).toBe(false);
    expect(shouldEvict({})).toBe(false);
    expect(shouldEvict(undefined)).toBe(false);
  });
});

describe('canSignIn (SEC-11)', () => {
  it('refuses a Deactivated or Disabled account even when isApproved is still true', () => {
    // AgentDatabase's Deactivate button sets only status and leaves isApproved true.
    expect(canSignIn({ status: 'Deactivated', isApproved: true }, false)).toBe(false);
    expect(canSignIn({ status: 'disabled', isApproved: true }, false)).toBe(false);
  });

  it('admits an active approved account and a legacy record with no status', () => {
    expect(canSignIn({ status: 'Active', isApproved: true }, false)).toBe(true);
    expect(canSignIn({ status: 'Active' }, false)).toBe(true);
    expect(canSignIn({ isApproved: true }, false)).toBe(true);
  });

  it('refuses a pending or unapproved account and a missing record', () => {
    expect(canSignIn({ status: 'Pending', isApproved: false }, false)).toBe(false);
    expect(canSignIn({ isApproved: false }, false)).toBe(false);
    expect(canSignIn(undefined, false)).toBe(false);
  });

  it('always admits a bootstrap super admin, who self-heals to Active', () => {
    expect(canSignIn({ status: 'Deactivated', isApproved: false }, true)).toBe(true);
  });
});
