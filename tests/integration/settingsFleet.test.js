import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { setupRulesEnv, clearAll, seedPermissions, asRole, unauthedFirestore } from '../helpers/emulator';

// FEA-4 (logistics D-7): settings/fleet holds the vehicle and driver lists the logistics
// pickers use. Admin writes it; roles that can view logistics read it; nobody else.

let testEnv;

beforeAll(async () => {
  testEnv = await setupRulesEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await clearAll(testEnv);
  await seedPermissions(testEnv);
  await testEnv.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), 'settings', 'fleet'), { vehicles: [], drivers: [] })
  );
});

const dbAs = async (role) => (await asRole(testEnv, role, `${role.toLowerCase().replace(/\s/g, '')}@example.com`)).firestore();

const fleet = { vehicles: [{ id: 'v1', name: 'Van', type: 'Van', capacity: 'Cargo' }], drivers: [{ name: 'Ravi', phone: '0771111111', role: 'Driver' }] };

describe('settings/fleet rules (FEA-4)', () => {
  it('lets an Admin write the document', async () => {
    await assertSucceeds(setDoc(doc(await dbAs('Admin'), 'settings', 'fleet'), fleet));
    await assertSucceeds(updateDoc(doc(await dbAs('Admin'), 'settings', 'fleet'), { drivers: [] }));
  });

  it.each(['Manager', 'Operations', 'Sales'])('refuses a write from %s', async (role) => {
    await assertFails(setDoc(doc(await dbAs(role), 'settings', 'fleet'), fleet));
    await assertFails(updateDoc(doc(await dbAs(role), 'settings', 'fleet'), { drivers: [] }));
  });

  it.each(['Admin', 'Manager', 'Operations', 'Sales'])('lets %s read the document', async (role) => {
    await assertSucceeds(getDoc(doc(await dbAs(role), 'settings', 'fleet')));
  });

  it('refuses a read from a role without logistics access', async () => {
    await assertFails(getDoc(doc(await dbAs('Accounts'), 'settings', 'fleet')));
  });

  it('refuses a signed-out read and write', async () => {
    const db = unauthedFirestore(testEnv);
    await assertFails(getDoc(doc(db, 'settings', 'fleet')));
    await assertFails(setDoc(doc(db, 'settings', 'fleet'), fleet));
  });
});
