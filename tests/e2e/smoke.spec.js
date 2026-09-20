import { test, expect } from '@playwright/test';

const ADMIN = { email: 'admin@example.com', password: 'Passw0rd!test' };

test('the app loads and shows the sign-in form', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Email or Mobile')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});

test('the seeded Admin signs in and reaches the dashboard', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email or Mobile').fill(ADMIN.email);
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible();
  await expect(page.getByLabel('Email or Mobile')).toHaveCount(0);
});
