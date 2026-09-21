import { describe, it, expect, vi, beforeEach } from 'vitest';

let stored;
const set = vi.fn((ref, data) => { stored = data.value; });

vi.mock('@/services/firebase', () => ({ db: {}, handleFirestoreError: vi.fn(), OperationType: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn((db, col, id) => ({ id })), addDoc: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(),
  deleteDoc: vi.fn(), onSnapshot: vi.fn(), query: vi.fn(), orderBy: vi.fn(), serverTimestamp: vi.fn(), writeBatch: vi.fn(),
  runTransaction: vi.fn(async (db, fn) => fn({
    get: async () => ({ exists: () => stored !== undefined, data: () => ({ value: stored }) }),
    set,
  })),
}));

const { generateAtomicId } = await import('@/services/firestoreSync');

describe('generateAtomicId', () => {
  beforeEach(() => { stored = undefined; set.mockClear(); });

  it('starts at 1 and pads to four digits by default', async () => {
    expect(await generateAtomicId('L')).toBe('L-0001');
    expect(stored).toBe(1);
  });

  it('continues from the stored counter for the same prefix', async () => {
    stored = 41;
    expect(await generateAtomicId('D')).toBe('D-0042');
    expect(await generateAtomicId('D', 6)).toBe('D-000043');
  });

  it('writes only the single value field, which is all the counters rule accepts', async () => {
    await generateAtomicId('PTF');
    expect(set).toHaveBeenCalledWith({ id: 'PTF' }, { value: 1 }, { merge: true });
  });
});
