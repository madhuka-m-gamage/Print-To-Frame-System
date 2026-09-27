import { test, expect } from '@playwright/test';
import { loadDefaultPermissions } from '../fixtures/defaultPermissions.mjs';
import { signInAndWait } from './helpers.js';

const PERMISSIONS = loadDefaultPermissions();

// Sidebar order and labels from App.jsx; an entry shows when the role can view its module.
const NAV = [
  ['Dashboard', 'dashboard'], ['Notifications', 'notifications'], ['Leads', 'leads'], ['Deals', 'pipeline'],
  ['Customers', 'customers'], ['User Management', 'agents'], ['Partners', 'partners'], ['Invoices', 'invoices'],
  ['Receipts', 'receipts'], ['Fabrication Works', 'projects'], ['Logistics', 'logistics'],
  ['Cost Calculator', 'calculator'], ['Messages', 'messages'], ['My Profile', null], ['System Overview', 'admin'],
  ['Sign Out', null],
];

const expectedNav = (role) =>
  role === 'Partner'
    ? ['Dashboard', 'Notifications', 'Partners', 'My Profile', 'Sign Out'] // App.jsx's fixed Partner nav
    : NAV.filter(([, module]) => !module || PERMISSIONS[role][module]?.view).map(([label]) => label);

const ROLES = [
  ['Admin', 'admin@example.com'],
  ['Manager', 'manager@example.com'],
  ['Sales', 'sales@example.com'],
  ['Partner', 'partner@example.com'],
  ['Customer', 'customer@example.com'],
];

for (const [role, email] of ROLES) {
  test(`${role} sees only its navigation`, async ({ page }) => {
    await signInAndWait(page, email);
    const sidebar = page.getByRole('navigation').first();
    // NavGroup headers are also buttons; their accessible name ends in "section, expanded".
    const names = (await sidebar.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') || '')))
      .filter((label) => !label.includes(' section, '))
      .map((label) => label.replace(/, \d+ unread notifications$/, ''));
    expect(names).toEqual(expectedNav(role));
  });
}

// Characterisation (TST-2 finding): the seeded user has status 'Deactivated' but isApproved true,
// which is what AgentDatabase's Deactivate button leaves behind. App.jsx's login check admits
// `isApproved || status === 'Active'`, so this user reaches the Dashboard. Flip to expect the
// sign-in form and the "deactivated" error once that check honours status (see TST-2 in BACKLOG.md).
test('the deactivated user still signs in (known defect)', async ({ page }) => {
  await signInAndWait(page, 'deactivated@example.com');
  await expect(page.getByLabel('Email or Mobile')).toHaveCount(0);
});
