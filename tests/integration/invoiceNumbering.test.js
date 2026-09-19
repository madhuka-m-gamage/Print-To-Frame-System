import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, runTransaction } from 'firebase/firestore';

/**
 * Exercises the atomic invoice-numbering scheme (Phase 10) against the real
 * Firebase Emulator (run via `npm run test:rules`) — proving two things a
 * unit test against a mocked Firestore couldn't:
 *   1. firestore.rules actually permits an authenticated user to read/write
 *      the new `counters/{prefix}` documents (and rejects an unauthenticated
 *      one), matching the rule added alongside generateInvoiceId().
 *   2. The transaction genuinely prevents duplicate numbers under real
 *      concurrency — the specific bug class a client-side "read the array,
 *      compute max+1" approach (the OLD `Date.now()`-based generators, and
 *      even the pre-existing non-transactional generateSequentialId) cannot
 *      guarantee.
 *
 * This mirrors generateInvoiceId()'s exact transaction shape
 * (src/services/firestoreSync.js) rather than importing it directly, the
 * same way firestoreRules.test.js exercises rules with raw firebase/firestore
 * calls instead of the app's firestoreSync.js wrappers — generateInvoiceId
 * imports `db` from services/firebase.js, a real production-config Firebase
 * app instance, which isn't the emulator-backed instance this test needs.
 */

const PROJECT_ID = 'demo-print2frame-test';

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

function unauthedFirestore() {
  return testEnv.unauthenticatedContext().firestore();
}

// Verbatim mirror of generateInvoiceId()'s transaction body.
async function generateNextNumber(db, prefix) {
  const counterRef = doc(db, 'counters', prefix);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const current = snap.exists() ? Number(snap.data().value) || 0 : 0;
    const next = current + 1;
    transaction.set(counterRef, { value: next }, { merge: true });
    return next;
  });
}

describe('firestore.rules: counters/{counterId}', () => {
  it('lets an authenticated user read and write a counter document', async () => {
    const db = authedFirestore('admin@example.com');
    await assertSucceeds(generateNextNumber(db, 'INV-ADV'));
  });

  it('rejects an unauthenticated caller', async () => {
    const db = unauthedFirestore();
    await assertFails(generateNextNumber(db, 'INV-ADV'));
  });
});

describe('Atomic invoice numbering: sequential correctness', () => {
  it('increments 1, 2, 3... across successive calls', async () => {
    const db = authedFirestore('admin@example.com');
    const first = await generateNextNumber(db, 'INV-ADV');
    const second = await generateNextNumber(db, 'INV-ADV');
    const third = await generateNextNumber(db, 'INV-ADV');
    expect([first, second, third]).toEqual([1, 2, 3]);
  });

  it('keeps Advance and Final counters independent', async () => {
    const db = authedFirestore('admin@example.com');
    await generateNextNumber(db, 'INV-ADV');
    await generateNextNumber(db, 'INV-ADV');
    const finalFirst = await generateNextNumber(db, 'INV-FIN');
    expect(finalFirst).toBe(1);
  });
});

describe('Atomic invoice numbering: concurrency safety', () => {
  // 10 simultaneous calls is already far more contention than this app will
  // ever see in practice (a small business's admin team, not a high-traffic
  // service) — enough to prove real concurrent transactions on the same
  // document don't collide, without pushing into territory where the local
  // JVM Firestore emulator's own transaction-retry performance (not this
  // code's correctness) becomes the bottleneck. A 30s timeout gives Firestore
  // room for legitimate optimistic-concurrency retries under that load rather
  // than a false failure from Vitest's 5s default.
  it('never hands out the same number twice under real concurrent calls', async () => {
    const db = authedFirestore('admin@example.com');
    const CONCURRENCY = 10;
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => generateNextNumber(db, 'INV-ADV'))
    );

    const uniqueValues = new Set(results);
    expect(uniqueValues.size).toBe(CONCURRENCY);

    // Also confirms no numbers were skipped — every integer 1..CONCURRENCY
    // was handed out exactly once, not just "no duplicates."
    const sorted = [...results].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: CONCURRENCY }, (_, i) => i + 1));
  }, 30000);
});
