import { readFileSync } from 'fs';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

/**
 * Exercises firestore.rules against the real Firebase Emulator (run via
 * `npm run test:rules`, which wraps this in `firebase emulators:exec`) —
 * these assertions can't be made against mocked/in-memory Firestore, since
 * the whole point is proving the *server-side* rule actually rejects what
 * it claims to reject, independent of anything the client UI does.
 *
 * Focus: the `users/{userId}` role-escalation guard. The comment above that
 * match block in firestore.rules calls this out as the specific thing that
 * must never regress — "a non-admin flipping their own role to 'Admin' ...
 * via the Firestore SDK directly (bypassing the UI) — is rejected."
 */

const PROJECT_ID = 'demo-print2frame-test';
const BOOTSTRAP_ADMIN_EMAIL = 'madhukagamage6@gmail.com';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function authedFirestore(email) {
  return testEnv.authenticatedContext(email, { email }).firestore();
}

async function seedUser(email, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', email), data);
  });
}

describe('firestore.rules: users/{userId} role-escalation guard', () => {
  it('lets a brand-new sign-in self-provision as an unapproved, pending Customer', async () => {
    const db = authedFirestore('newuser@example.com');
    await assertSucceeds(
      setDoc(doc(db, 'users', 'newuser@example.com'), {
        identifier: 'newuser@example.com',
        role: 'Customer',
        isApproved: false,
        status: 'Pending',
      })
    );
  });

  it('rejects a brand-new sign-in creating itself directly as an Admin', async () => {
    const db = authedFirestore('attacker@example.com');
    await assertFails(
      setDoc(doc(db, 'users', 'attacker@example.com'), {
        identifier: 'attacker@example.com',
        role: 'Admin',
        isApproved: true,
        status: 'Active',
      })
    );
  });

  it('rejects a non-admin updating their own doc to change role to Admin', async () => {
    await seedUser('customer@example.com', {
      identifier: 'customer@example.com',
      role: 'Customer',
      isApproved: true,
      status: 'Active',
      name: 'Original Name',
    });
    const db = authedFirestore('customer@example.com');
    await assertFails(
      updateDoc(doc(db, 'users', 'customer@example.com'), { role: 'Admin' })
    );
  });

  it('rejects a non-admin self-approving after being deactivated', async () => {
    await seedUser('deactivated@example.com', {
      identifier: 'deactivated@example.com',
      role: 'Sales',
      isApproved: true,
      status: 'Inactive',
    });
    const db = authedFirestore('deactivated@example.com');
    await assertFails(
      updateDoc(doc(db, 'users', 'deactivated@example.com'), { status: 'Active' })
    );
  });

  it('allows a non-admin to update unrelated fields on their own doc', async () => {
    await seedUser('customer2@example.com', {
      identifier: 'customer2@example.com',
      role: 'Customer',
      isApproved: true,
      status: 'Active',
      name: 'Original Name',
    });
    const db = authedFirestore('customer2@example.com');
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'customer2@example.com'), { name: 'Updated Name' })
    );
  });

  it('allows an Admin to change another user\'s role', async () => {
    await seedUser('admin@example.com', {
      identifier: 'admin@example.com',
      role: 'Admin',
      isApproved: true,
      status: 'Active',
    });
    await seedUser('promotee@example.com', {
      identifier: 'promotee@example.com',
      role: 'Sales',
      isApproved: true,
      status: 'Active',
    });
    const adminDb = authedFirestore('admin@example.com');
    await assertSucceeds(
      updateDoc(doc(adminDb, 'users', 'promotee@example.com'), { role: 'Manager' })
    );
    const updated = await getDoc(doc(adminDb, 'users', 'promotee@example.com'));
    expect(updated.data().role).toBe('Manager');
  });

  it('lets the bootstrap super-admin email self-heal to Admin even with no prior doc', async () => {
    const db = authedFirestore(BOOTSTRAP_ADMIN_EMAIL);
    await assertSucceeds(
      setDoc(doc(db, 'users', BOOTSTRAP_ADMIN_EMAIL), {
        identifier: BOOTSTRAP_ADMIN_EMAIL,
        role: 'Admin',
        isApproved: true,
        status: 'Active',
      })
    );
  });

  it('rejects an unauthenticated write to any user document', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(anonDb, 'users', 'anonymous@example.com'), {
        identifier: 'anonymous@example.com',
        role: 'Admin',
        isApproved: true,
        status: 'Active',
      })
    );
  });
});

describe('firestore.rules: catch-all deny', () => {
  it('rejects reads/writes to any collection with no explicit match block', () => {
    // Also serves as the canary for this whole test file: if someone ever adds a
    // broad `match /{document=**} { allow read, write: if true }` (or the emulator
    // silently falls back to its own allow-everything default instead of enforcing
    // the rules this suite uploads), this is the test that catches it.
    const db = authedFirestore('anyone@example.com');
    return assertFails(
      setDoc(doc(db, 'zzz_totally_unmatched_diagnostic_collection', 'doc1'), { x: 1 })
    );
  });
});
