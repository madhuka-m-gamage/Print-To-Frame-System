import { describe, it, expect } from 'vitest';
import { newUserAction, shouldEvict } from '../../src/utils/authFlow';

describe('newUserAction', () => {
  it('always creates the record for a bootstrap admin', () => {
    expect(newUserAction({ isBootstrapAdmin: true, registering: false })).toBe('create_admin');
    expect(newUserAction({ isBootstrapAdmin: true, registering: true })).toBe('create_admin');
  });

  it('leaves a sign-up in progress alone instead of racing it with a shell record', () => {
    expect(newUserAction({ isBootstrapAdmin: false, registering: true })).toBe('wait_for_registration');
  });

  it('queues any other first-time sign-in for approval', () => {
    expect(newUserAction({ isBootstrapAdmin: false, registering: false })).toBe('queue_pending');
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
