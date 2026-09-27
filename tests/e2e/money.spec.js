import { test, expect } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { signInAndWait } from './helpers.js';

// Seeded by tests/fixtures/seed.mjs: a deal with an Accepted LKR 200,000 quotation and no invoices.
const DEAL_ID = 'D-200001';

async function invoicesForDeal() {
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  const snap = await getFirestore().collection('invoices').where('leadId', '==', DEAL_ID).get();
  return snap.docs.map((d) => d.data());
}

test('an accepted quotation yields one Advance and exactly one Final invoice', async ({ page }) => {
  await signInAndWait(page, 'admin@example.com');
  await page.getByRole('button', { name: 'Deals', exact: true }).click();
  await page.getByText('Money Journey Client').first().click();

  await page.getByRole('button', { name: /75% Advance Invoice/ }).click();
  await expect(page.getByText(/Advance Invoice Generated — INV-ADV-/)).toBeVisible();

  const final = page.getByRole('button', { name: /25% Final Settlement/ });
  await final.click();
  await expect(page.getByText(/Final Settlement Generated — INV-FIN-/)).toBeVisible();
  await expect(final).toHaveCount(0);

  await expect.poll(async () => (await invoicesForDeal()).length).toBe(2);
  const invoices = await invoicesForDeal();
  const finals = invoices.filter((inv) => inv.type === 'Final');
  const advances = invoices.filter((inv) => inv.type === 'Advance');
  expect(finals).toHaveLength(1);
  expect(finals[0].id).toMatch(/^INV-FIN-/);
  expect(finals[0].amount).toBe(50000);
  expect(advances).toHaveLength(1);
  expect(advances[0].amount).toBe(150000);
});
