import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/firebase', () => ({
  db: {},
  handleFirestoreError: vi.fn(),
  OperationType: {},
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(), addDoc: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(),
  deleteDoc: vi.fn(), onSnapshot: vi.fn(), query: vi.fn(), orderBy: vi.fn(),
  serverTimestamp: vi.fn(), writeBatch: vi.fn(), runTransaction: vi.fn(),
}));

const { deriveReceiptId, generateSequentialId } = await import('@/services/firestoreSync');

describe('firestoreSync pure helpers', () => {
  describe('deriveReceiptId', () => {
    it('maps the invoice id prefix to the receipt prefix, keeping the number', () => {
      expect(deriveReceiptId('INV-ADV-0007')).toBe('REC-ADV-0007');
      expect(deriveReceiptId('INV-FIN-0007')).toBe('REC-FIN-0007');
    });

    it('falls back to REC-<id> for legacy ids and never throws on empty input', () => {
      expect(deriveReceiptId('INV-1002')).toBe('REC-INV-1002');
      expect(deriveReceiptId(undefined)).toBe('REC-');
    });
  });

  describe('generateSequentialId', () => {
    it('starts at 1 for an empty list', () => {
      expect(generateSequentialId('L', [])).toBe('L-001');
    });

    it('uses max + 1 of the numeric tail, ignoring gaps and non-string ids', () => {
      const docs = [{ id: 'L-001' }, { id: 'L-010' }, { id: 5 }, {}, { id: 'bad' }];
      expect(generateSequentialId('L', docs)).toBe('L-011');
    });

    it('pads INV to four digits and everything else to three', () => {
      expect(generateSequentialId('INV', [{ id: 'INV-0009' }])).toBe('INV-0010');
      expect(generateSequentialId('J-24', [{ id: 'J-24-009' }])).toBe('J-24-010');
    });

    it('reads a custom id field', () => {
      expect(generateSequentialId('Q', [{ quoteNo: 'Q-002' }], 'quoteNo')).toBe('Q-003');
    });
  });
});
