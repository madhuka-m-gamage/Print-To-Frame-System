import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { setupRulesEnv, clearAll, seedPermissions, asRole, unauthedFirestore } from '../helpers/emulator';

// MON-4: an Advance or Final invoice is written in one transaction with
// invoice_guards/<rootLeadId>_<Advance|Final>, so a second one for the same lead fails
// even when two sessions race. Mirrors createDocumentIfAbsent's transaction shape
// (src/services/firestoreSync.js), which imports the production Firebase app.
// MON-12: a guard whose invoice is Cancelled or gone may be replaced by a new invoice's.

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
});

const dbAs = async (role) => (await asRole(testEnv, role, `${role.toLowerCase().replace(/\s/g, '')}@example.com`)).firestore();

const guard = (invoiceId, type = 'Advance') => ({ invoiceId, type, rootLeadId: 'L-001' });

async function createGuardedInvoice(db, invoiceId, type = 'Advance') {
  const invoiceRef = doc(db, 'invoices', invoiceId);
  const guardRef = doc(db, 'invoice_guards', `L-001_${type}`);
  await runTransaction(db, async (tx) => {
    const [invoiceSnap, guardSnap] = [await tx.get(invoiceRef), await tx.get(guardRef)];
    let guardHeld = guardSnap.exists();
    if (guardHeld) {
      const named = await tx.get(doc(db, 'invoices', guardSnap.data().invoiceId));
      guardHeld = named.exists() && named.data().status !== 'Cancelled';
    }
    if (invoiceSnap.exists() || guardHeld) throw new Error('ALREADY_EXISTS');
    tx.set(invoiceRef, { id: invoiceId, leadId: 'L-001', type, amount: 750, createdAt: serverTimestamp() });
    tx.set(guardRef, { ...guard(invoiceId, type), createdAt: serverTimestamp() });
  });
}

// Skips the client-side check, so only the rules stand between it and the guard.
async function forceGuardedInvoice(db, invoiceId, type = 'Advance', guardData = guard(invoiceId, type)) {
  await runTransaction(db, async (tx) => {
    tx.set(doc(db, 'invoices', invoiceId), { id: invoiceId, leadId: 'L-001', type, amount: 750, createdAt: serverTimestamp() });
    tx.set(doc(db, 'invoice_guards', `L-001_${type}`), { ...guardData, createdAt: serverTimestamp() });
  });
}

const setInvoice = (id, data) => testEnv.withSecurityRulesDisabled(async (ctx) => {
  const ref = doc(ctx.firestore(), 'invoices', id);
  await (data ? updateDoc(ref, data) : deleteDoc(ref));
});

const guardInvoiceId = async () => {
  let id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    id = (await getDoc(doc(ctx.firestore(), 'invoice_guards', 'L-001_Final'))).data().invoiceId;
  });
  return id;
};

const exists = async (path, id) => {
  let found;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    found = (await getDoc(doc(ctx.firestore(), path, id))).exists();
  });
  return found;
};

describe('invoice_guards rules (MON-4)', () => {
  it.each(['Admin', 'Manager', 'Sales', 'Accounts', 'Operations'])('lets %s (invoices create) write an invoice with its guard', async (role) => {
    await assertSucceeds(createGuardedInvoice(await dbAs(role), 'INV-ADV-0001'));
    expect(await exists('invoice_guards', 'L-001_Advance')).toBe(true);
  });

  it.each(['Support', 'Logistics', 'Partner', 'Customer', 'Business Client'])('refuses %s creating a guard', async (role) => {
    await assertFails(setDoc(doc(await dbAs(role), 'invoice_guards', 'L-001_Advance'), guard('INV-ADV-0001')));
  });

  it('refuses a signed-out caller', async () => {
    await assertFails(setDoc(doc(unauthedFirestore(testEnv), 'invoice_guards', 'L-001_Advance'), guard('INV-ADV-0001')));
  });

  it('refuses a second create of the same guard id, even by an Admin', async () => {
    const db = await dbAs('Admin');
    await createGuardedInvoice(db, 'INV-ADV-0001');
    await assertFails(setDoc(doc(db, 'invoice_guards', 'L-001_Advance'), guard('INV-ADV-0002')));
    await expect(createGuardedInvoice(db, 'INV-ADV-0002')).rejects.toThrow('ALREADY_EXISTS');
    expect(await exists('invoices', 'INV-ADV-0002')).toBe(false);
  });

  it('keeps Advance and Final separate for the same lead', async () => {
    const db = await dbAs('Accounts');
    await createGuardedInvoice(db, 'INV-ADV-0001', 'Advance');
    await assertSucceeds(createGuardedInvoice(db, 'INV-FIN-0001', 'Final'));
  });

  it('lets only one of two racing sessions create the Final invoice', async () => {
    const [a, b] = [await dbAs('Admin'), await dbAs('Accounts')];
    const results = await Promise.allSettled([
      createGuardedInvoice(a, 'INV-FIN-0001', 'Final'),
      createGuardedInvoice(b, 'INV-FIN-0002', 'Final'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const written = [await exists('invoices', 'INV-FIN-0001'), await exists('invoices', 'INV-FIN-0002')];
    expect(written.filter(Boolean)).toHaveLength(1);
  });

  it('lets invoice viewers read a guard', async () => {
    await createGuardedInvoice(await dbAs('Admin'), 'INV-ADV-0001');
    await assertSucceeds(getDoc(doc(await dbAs('Support'), 'invoice_guards', 'L-001_Advance')));
    await assertFails(getDoc(doc(await dbAs('Partner'), 'invoice_guards', 'L-001_Advance')));
  });

  it('refuses everyone updating or deleting a guard whose invoice is live', async () => {
    await createGuardedInvoice(await dbAs('Admin'), 'INV-ADV-0001');
    for (const role of ['Admin', 'Manager', 'Accounts']) {
      const db = await dbAs(role);
      await assertFails(updateDoc(doc(db, 'invoice_guards', 'L-001_Advance'), { invoiceId: 'INV-ADV-0009' }));
      await assertFails(deleteDoc(doc(db, 'invoice_guards', 'L-001_Advance')));
    }
  });

  describe('replacing the guard of a cancelled or deleted invoice (MON-12)', () => {
    it('lets a new Final replace the guard when the named invoice is Cancelled', async () => {
      const db = await dbAs('Accounts');
      await createGuardedInvoice(db, 'INV-FIN-0001', 'Final');
      await setInvoice('INV-FIN-0001', { status: 'Cancelled' });
      await assertSucceeds(createGuardedInvoice(db, 'INV-FIN-0002', 'Final'));
      expect(await guardInvoiceId()).toBe('INV-FIN-0002');
    });

    it('lets a new Final replace the guard when the named invoice no longer exists', async () => {
      const db = await dbAs('Admin');
      await createGuardedInvoice(db, 'INV-FIN-0001', 'Final');
      await setInvoice('INV-FIN-0001', null);
      await assertSucceeds(createGuardedInvoice(db, 'INV-FIN-0002', 'Final'));
      expect(await guardInvoiceId()).toBe('INV-FIN-0002');
    });

    it('refuses replacing the guard while the named invoice is live, whatever its other status', async () => {
      const db = await dbAs('Admin');
      await createGuardedInvoice(db, 'INV-FIN-0001', 'Final');
      await assertFails(forceGuardedInvoice(db, 'INV-FIN-0002', 'Final'));
      await setInvoice('INV-FIN-0001', { status: 'Paid' });
      await assertFails(forceGuardedInvoice(db, 'INV-FIN-0002', 'Final'));
      expect(await exists('invoices', 'INV-FIN-0002')).toBe(false);
      expect(await guardInvoiceId()).toBe('INV-FIN-0001');
    });

    it('refuses a replacement that writes no new invoice or moves the guard to another lead', async () => {
      const db = await dbAs('Admin');
      await createGuardedInvoice(db, 'INV-FIN-0001', 'Final');
      await setInvoice('INV-FIN-0001', { status: 'Cancelled' });
      await assertFails(setDoc(doc(db, 'invoice_guards', 'L-001_Final'), guard('INV-FIN-0009', 'Final')));
      await assertFails(forceGuardedInvoice(db, 'INV-FIN-0002', 'Final', { ...guard('INV-FIN-0002', 'Final'), rootLeadId: 'L-002' }));
    });

    it('refuses a replacement by a role that cannot create invoices', async () => {
      await createGuardedInvoice(await dbAs('Admin'), 'INV-FIN-0001', 'Final');
      await setInvoice('INV-FIN-0001', { status: 'Cancelled' });
      await assertFails(setDoc(doc(await dbAs('Support'), 'invoice_guards', 'L-001_Final'), guard('INV-FIN-0002', 'Final')));
    });

    it('still refuses deleting the guard of a cancelled invoice', async () => {
      const db = await dbAs('Admin');
      await createGuardedInvoice(db, 'INV-FIN-0001', 'Final');
      await setInvoice('INV-FIN-0001', { status: 'Cancelled' });
      await assertFails(deleteDoc(doc(db, 'invoice_guards', 'L-001_Final')));
    });

    it('lets only one of two racing replacements win', async () => {
      const [a, b] = [await dbAs('Admin'), await dbAs('Accounts')];
      await createGuardedInvoice(a, 'INV-FIN-0001', 'Final');
      await setInvoice('INV-FIN-0001', { status: 'Cancelled' });
      const results = await Promise.allSettled([
        createGuardedInvoice(a, 'INV-FIN-0002', 'Final'),
        createGuardedInvoice(b, 'INV-FIN-0003', 'Final'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const written = [await exists('invoices', 'INV-FIN-0002'), await exists('invoices', 'INV-FIN-0003')];
      expect(written.filter(Boolean)).toHaveLength(1);
    });
  });
});
