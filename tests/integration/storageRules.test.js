import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
import { setupStorageRulesEnv, seedUser } from '../helpers/emulator';

// Owner decision DEC-3: Storage is enabled with narrow rules. Staff (approved, active, not a
// Partner / Customer / Business Client) read and add blueprints and partner documents; the
// public partner registration form may only add its own documents, never read them.

const SUPER_ADMIN = 'madhukagamage6@gmail.com';
const PDF = { contentType: 'application/pdf' };
const bytes = (n = 16) => new Uint8Array(n);

let testEnv;
const storageAs = (email) => (email ? testEnv.authenticatedContext(email, { email }) : testEnv.unauthenticatedContext()).storage();

beforeAll(async () => {
  testEnv = await setupStorageRulesEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await seedUser(testEnv, 'ops@example.com', { role: 'Operations', isApproved: true, status: 'Active' });
  await seedUser(testEnv, 'partner@example.com', { role: 'Partner', isApproved: true, status: 'Active' });
  await seedUser(testEnv, 'gone@example.com', { role: 'Sales', isApproved: true, status: 'Deactivated' });
});

async function seedFile(path) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), path), bytes(), PDF);
  });
}

describe('blueprints/', () => {
  it('lets active staff add and read a blueprint', async () => {
    const s = storageAs('ops@example.com');
    await assertSucceeds(uploadBytes(ref(s, 'blueprints/PTF-0001/1_plan.pdf'), bytes(), PDF));
    await assertSucceeds(getBytes(ref(s, 'blueprints/PTF-0001/1_plan.pdf')));
  });

  it('lets the super admin in even without a users document', async () => {
    await assertSucceeds(uploadBytes(ref(storageAs(SUPER_ADMIN), 'blueprints/PTF-0001/2_plan.png'), bytes(), { contentType: 'image/png' }));
  });

  it('refuses partners, deactivated staff and signed-out visitors', async () => {
    await seedFile('blueprints/PTF-0001/1_plan.pdf');
    for (const who of ['partner@example.com', 'gone@example.com', null]) {
      await assertFails(uploadBytes(ref(storageAs(who), 'blueprints/PTF-0001/3_plan.pdf'), bytes(), PDF));
      await assertFails(getBytes(ref(storageAs(who), 'blueprints/PTF-0001/1_plan.pdf')));
    }
  });

  it('refuses anything but an image or PDF, and files of 10MB or more', async () => {
    const s = storageAs('ops@example.com');
    await assertFails(uploadBytes(ref(s, 'blueprints/PTF-0001/run.exe'), bytes(), { contentType: 'application/octet-stream' }));
    await assertFails(uploadBytes(ref(s, 'blueprints/PTF-0001/big.pdf'), bytes(10 * 1024 * 1024), PDF));
  });

  it('never overwrites an existing file', async () => {
    await seedFile('blueprints/PTF-0001/1_plan.pdf');
    await assertFails(uploadBytes(ref(storageAs('ops@example.com'), 'blueprints/PTF-0001/1_plan.pdf'), bytes(), PDF));
  });
});

describe('partners/{partnerId}/ document vault', () => {
  it('lets active staff add and read partner documents', async () => {
    const s = storageAs('ops@example.com');
    await assertSucceeds(uploadBytes(ref(s, 'partners/P-0001/agreement_1_a.pdf'), bytes(), PDF));
    await assertSucceeds(getBytes(ref(s, 'partners/P-0001/agreement_1_a.pdf')));
  });

  it('refuses partners and signed-out visitors', async () => {
    await seedFile('partners/P-0001/agreement_1_a.pdf');
    for (const who of ['partner@example.com', null]) {
      await assertFails(uploadBytes(ref(storageAs(who), 'partners/P-0001/agreement_2_a.pdf'), bytes(), PDF));
      await assertFails(getBytes(ref(storageAs(who), 'partners/P-0001/agreement_1_a.pdf')));
    }
  });
});

describe('partners/applications/ public registration uploads', () => {
  it('lets a signed-out visitor add a BR or NIC copy under an application id', async () => {
    const s = storageAs(null);
    await assertSucceeds(uploadBytes(ref(s, 'partners/applications/APP-123456/br_cert.pdf'), bytes(), PDF));
    await assertSucceeds(uploadBytes(ref(s, 'partners/applications/APP-123456/nic_front.jpg'), bytes(), { contentType: 'image/jpeg' }));
  });

  it('never lets the visitor read a document back, but staff can', async () => {
    await seedFile('partners/applications/APP-123456/br_cert.pdf');
    await assertFails(getBytes(ref(storageAs(null), 'partners/applications/APP-123456/br_cert.pdf')));
    await assertFails(getBytes(ref(storageAs('partner@example.com'), 'partners/applications/APP-123456/br_cert.pdf')));
    await assertSucceeds(getBytes(ref(storageAs('ops@example.com'), 'partners/applications/APP-123456/br_cert.pdf')));
  });

  it('refuses overwrites, other names, other file types and files of 5MB or more', async () => {
    await seedFile('partners/applications/APP-123456/br_cert.pdf');
    const s = storageAs(null);
    await assertFails(uploadBytes(ref(s, 'partners/applications/APP-123456/br_cert.pdf'), bytes(), PDF));
    await assertFails(uploadBytes(ref(s, 'partners/applications/APP-123456/other.pdf'), bytes(), PDF));
    await assertFails(uploadBytes(ref(s, 'partners/applications/not-an-id/br_cert.pdf'), bytes(), PDF));
    await assertFails(uploadBytes(ref(s, 'partners/applications/APP-123456/nic_x.html'), bytes(), { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(s, 'partners/applications/APP-123456/br_big.pdf'), bytes(5 * 1024 * 1024), PDF));
  });
});

describe('everything else', () => {
  it('is closed, even to staff', async () => {
    await assertFails(uploadBytes(ref(storageAs('ops@example.com'), 'misc/file.pdf'), bytes(), PDF));
  });
});
