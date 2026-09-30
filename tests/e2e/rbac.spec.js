import { test, expect } from '@playwright/test';
import { loadDefaultPermissions } from '../fixtures/defaultPermissions.mjs';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { signIn, signInAndWait } from './helpers.js';

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

// Flipped in SEC-11 (TST-2 finding): the seeded user has status 'Deactivated' but isApproved true,
// which is what AgentDatabase's Deactivate button leaves behind; the login check now honours status.
test('the deactivated user cannot sign in', async ({ page }) => {
  await signIn(page, 'deactivated@example.com');
  await expect(page.getByText('Your account has been disabled or deactivated.')).toBeVisible();
  await expect(page.getByLabel('Email or Mobile')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dashboard' })).toHaveCount(0);
});

// SEC-11: a staff user lists the whole users collection, which the rules refuse once the caller is
// Deactivated, so the eviction also has to come from the user's own document.
test('a user deactivated mid-session is signed out', async ({ page }) => {
  await signInAndWait(page, 'evicted@example.com');
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  await getFirestore().doc('users/evicted@example.com').update({ status: 'Deactivated' });
  await expect(page.getByText('Your account has been deactivated by an administrator.')).toBeVisible();
  await expect(page.getByLabel('Email or Mobile')).toBeVisible();
});
