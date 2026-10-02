import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { setupRulesEnv, clearAll, authedFirestore, unauthedFirestore } from '../helpers/emulator';

// SEC-12: typing_indicators/{email} holds one indicator per user (written by Messages.jsx).
let testEnv;

beforeAll(async () => {
  testEnv = await setupRulesEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await clearAll(testEnv);
});

const A = 'a@example.com';
const B = 'b@example.com';
const OUTSIDER = 'outsider@example.com';

const indicator = (fromId, other, extra = {}) => ({
  fromId,
  channelId: [fromId, other].sort().join('_'),
  participants: [fromId, other],
  isTyping: true,
  timestamp: 1,
  ...extra,
});

async function seedIndicator(id, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'typing_indicators', id), data);
  });
}

describe('firestore.rules: typing_indicators (SEC-12)', () => {
  it('lets a signed-in user write only their own indicator, in a chat they are part of', async () => {
    const a = authedFirestore(testEnv, A);
    await assertSucceeds(setDoc(doc(a, 'typing_indicators', A), indicator(A, B)));
    await assertSucceeds(setDoc(doc(a, 'typing_indicators', A), { isTyping: false, timestamp: 2 }, { merge: true }));
    await assertSucceeds(deleteDoc(doc(a, 'typing_indicators', A)));

    await assertFails(setDoc(doc(a, 'typing_indicators', B), indicator(B, A)));
    await assertFails(setDoc(doc(a, 'typing_indicators', A), indicator(B, A)));
    await assertFails(setDoc(doc(a, 'typing_indicators', A), { ...indicator(A, B), participants: [B, OUTSIDER] }));
    await assertFails(setDoc(doc(a, 'typing_indicators', A), { ...indicator(A, B), participants: [A, B, OUTSIDER] }));
    await assertFails(setDoc(doc(unauthedFirestore(testEnv), 'typing_indicators', A), indicator(A, B)));
  });

  it("does not let a user overwrite or delete someone else's indicator", async () => {
    await seedIndicator(B, indicator(B, A));
    const outsider = authedFirestore(testEnv, OUTSIDER);
    await assertFails(setDoc(doc(outsider, 'typing_indicators', B), { isTyping: false }, { merge: true }));
    await assertFails(deleteDoc(doc(outsider, 'typing_indicators', B)));
  });

  it("lets only the chat's participants read an indicator", async () => {
    await seedIndicator(A, indicator(A, B));
    await assertSucceeds(getDoc(doc(authedFirestore(testEnv, A), 'typing_indicators', A)));
    await assertSucceeds(getDoc(doc(authedFirestore(testEnv, B), 'typing_indicators', A)));
    await assertFails(getDoc(doc(authedFirestore(testEnv, OUTSIDER), 'typing_indicators', A)));
    await assertFails(getDoc(doc(unauthedFirestore(testEnv), 'typing_indicators', A)));
  });

  it('serves the participant query the app listens with, and refuses the whole collection', async () => {
    await seedIndicator(A, indicator(A, B));
    const b = authedFirestore(testEnv, B);
    await assertSucceeds(getDocs(query(collection(b, 'typing_indicators'), where('participants', 'array-contains', B))));
    await assertFails(getDocs(collection(b, 'typing_indicators')));
    const outsider = authedFirestore(testEnv, OUTSIDER);
    await assertFails(getDocs(query(collection(outsider, 'typing_indicators'), where('participants', 'array-contains', A))));
  });

  it('denies reading an indicator that has no participants field', async () => {
    const legacy = { fromId: A, channelId: [A, B].sort().join('_'), isTyping: true, timestamp: 1 };
    await seedIndicator(A, legacy);
    await assertFails(getDoc(doc(authedFirestore(testEnv, B), 'typing_indicators', A)));
    await assertFails(getDoc(doc(authedFirestore(testEnv, OUTSIDER), 'typing_indicators', A)));
    await assertFails(setDoc(doc(authedFirestore(testEnv, A), 'typing_indicators', A), legacy));
  });
});
