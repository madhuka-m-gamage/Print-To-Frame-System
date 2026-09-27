import { expect } from '@playwright/test';

export const PASSWORD = 'Passw0rd!test';

async function signIn(page, email) {
  await page.goto('/');
  await page.getByLabel('Email or Mobile').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}

export async function signInAndWait(page, email) {
  await signIn(page, email);
  await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible();
}
