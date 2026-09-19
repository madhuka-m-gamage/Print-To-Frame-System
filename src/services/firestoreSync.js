/**
 * ============================================================
 * Print To Frame ERP — Firestore Sync Service
 * ============================================================
 * Centralized CRUD operations and real-time listeners for all
 * business data collections. Replaces localStorage-based storage
 * with Firestore for multi-user real-time sync.
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

// ── Collection Names ─────────────────────────────────────────
export const COLLECTIONS = {
  LEADS: 'leads',
  CUSTOMERS: 'customers',
  PARTNERS: 'partners',
  PARTNER_APPLICATIONS: 'partner_applications',
  PARTNER_PAYOUTS: 'partner_payouts',
  PROJECTS: 'projects',
  LOGISTICS: 'logistics',
  INVOICES: 'invoices',
  RECEIPTS: 'receipts',
  QUOTATIONS: 'quotations',
  MESSAGES: 'messages',
  AUDIT_LOG: 'auditLog',
  USERS: 'users',
  PENDING_USERS: 'pendingUsers',
  SETTINGS: 'settings',
  REFERRAL_CLAIMS: 'referral_claims',
  TYPING_INDICATORS: 'typing_indicators',
  COUNTERS: 'counters',
};

// ── Subscribe to a Collection (Real-time) ────────────────────
/**
 * Subscribe to real-time updates on a Firestore collection.
 * @param {string} collectionName - Name of the Firestore collection
 * @param {function} callback - Called with array of documents on each update
 * @param {function} onError - Called if the listener encounters an error
 * @returns {function} unsubscribe function
 */
export function subscribeToCollection(collectionName, callback, onError) {
  const colRef = collection(db, collectionName);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const docs = [];
      snapshot.forEach((docSnap) => {
        docs.push({ _firestoreId: docSnap.id, ...docSnap.data() });
      });
      callback(docs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
      if (onError) onError(error);
    }
  );
}

// ── Subscribe to a Query (Real-time) ─────────────────────────
/**
 * Subscribe to real-time updates based on a Firestore query.
 * @param {import('firebase/firestore').Query} q - A Firestore query object
 * @param {function} callback - Called with array of documents on each update
 * @param {function} onError - Called if the listener encounters an error
 * @returns {function} unsubscribe function
 */
export function subscribeToQuery(q, callback, onError) {
  return onSnapshot(
    q,
    (snapshot) => {
      const docs = [];
      snapshot.forEach((docSnap) => {
        docs.push({ _firestoreId: docSnap.id, ...docSnap.data() });
      });
      callback(docs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'query');
      if (onError) onError(error);
    }
  );
}

// ── Add Document ─────────────────────────────────────────────
/**
 * Add a new document to a collection.
 * @param {string} collectionName
 * @param {object} data
 * @param {string} [customId] - Optional custom document ID
 * @returns {Promise<string>} The document ID
 */
export async function addDocument(collectionName, data, customId) {
  try {
    const docData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (customId) {
      await setDoc(doc(db, collectionName, customId), docData);
      return customId;
    }

    const docRef = await addDoc(collection(db, collectionName), docData);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionName);
    throw error;
  }
}

// ── Create Document If Absent (collision-safe) ───────────────
/**
 * Creates a document at a known custom id ONLY if it doesn't already exist,
 * checked and written inside a single Firestore transaction. Unlike
 * addDocument(collectionName, data, customId) — which does a plain setDoc
 * and would silently overwrite an existing document with the same id —
 * this is for cases where the id is deterministically derived (e.g. a
 * receipt id derived from its invoice id) and a second, in-flight call for
 * the same id must be rejected rather than clobbering the first: two
 * "Generate Receipt" clicks racing before the caller's own in-memory list
 * has refreshed (e.g. the card was closed before the real-time listener
 * caught up, then reopened and clicked again) must not both succeed.
 * @param {string} collectionName
 * @param {string} docId
 * @param {object} data
 * @throws {Error} with message 'ALREADY_EXISTS' if the document is already present
 * @returns {Promise<string>} the document id
 */
export async function createDocumentIfAbsent(collectionName, docId, data) {
  const docRef = doc(db, collectionName, docId);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (snap.exists()) {
        throw new Error('ALREADY_EXISTS');
      }
      transaction.set(docRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return docId;
  } catch (error) {
    if (error.message !== 'ALREADY_EXISTS') {
      handleFirestoreError(error, OperationType.CREATE, `${collectionName}/${docId}`);
    }
    throw error;
  }
}

// ── Update Document ──────────────────────────────────────────
/**
 * Update fields on an existing document.
 * @param {string} collectionName
 * @param {string} docId - The Firestore document ID
 * @param {object} data - Fields to update
 */
export async function updateDocument(collectionName, docId, data) {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${docId}`);
    throw error;
  }
}

// ── Set Document (Create or Overwrite) ───────────────────────
/**
 * Set a document (creates or overwrites).
 * @param {string} collectionName
 * @param {string} docId
 * @param {object} data
 * @param {boolean} merge - If true, merges with existing data
 */
export async function setDocument(collectionName, docId, data, merge = false) {
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionName}/${docId}`);
    throw error;
  }
}

// ── Delete Document ──────────────────────────────────────────
/**
 * Delete a document from a collection.
 * @param {string} collectionName
 * @param {string} docId
 */
export async function deleteDocument(collectionName, docId) {
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${docId}`);
    throw error;
  }
}

// ── Batch Operations ─────────────────────────────────────────
/**
 * Perform multiple write operations atomically.
 * @param {Array<{type: 'set'|'update'|'delete', collection: string, docId: string, data?: object}>} operations
 */
export async function batchWrite(operations) {
  const batch = writeBatch(db);

  for (const op of operations) {
    const docRef = doc(db, op.collection, op.docId);
    switch (op.type) {
      case 'set':
        batch.set(docRef, { ...op.data, updatedAt: serverTimestamp() });
        break;
      case 'update':
        batch.update(docRef, { ...op.data, updatedAt: serverTimestamp() });
        break;
      case 'delete':
        batch.delete(docRef);
        break;
    }
  }

  await batch.commit();
}

// ── Generate Sequential ID ──────────────────────────────────
/**
 * Generate a sequential business ID (e.g., L-004, INV-1002, J-24-003).
 * @param {string} prefix - e.g., "L", "INV", "J-24"
 * @param {Array} existingDocs - Current documents array
 * @param {string} idField - The field name containing the ID (default: "id")
 * @returns {string} The next sequential ID
 */
export function generateSequentialId(prefix, existingDocs, idField = 'id') {
  let maxNum = 0;

  for (const d of existingDocs) {
    const id = d[idField];
    if (!id || typeof id !== 'string') continue;
    // Extract the numeric part after the last dash
    const parts = id.split('-');
    const numPart = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(numPart) && numPart > maxNum) {
      maxNum = numPart;
    }
  }

  const nextNum = maxNum + 1;
  const padLength = prefix === 'INV' ? 4 : 3;
  return `${prefix}-${String(nextNum).padStart(padLength, '0')}`;
}

// ── Generate Atomic Sequential ID (collision-safe, any prefix) ────
/**
 * Atomically generates the next sequential number for the given prefix, via
 * a Firestore transaction against a per-prefix counter document
 * (counters/<prefix>). Unlike generateSequentialId above (which reads a
 * client-side array and computes max+1) or a Date.now()-suffixed id, a
 * transaction guarantees two concurrent callers — two admins creating an
 * invoice, or two dispatchers creating a logistics job, at the same
 * moment — can never be handed the same number: Firestore retries one of
 * them automatically on contention, where a truncated timestamp can
 * silently collide and overwrite an existing document with the same id.
 * @param {string} prefix e.g. "INV-ADV", "L-DL", "L-PK"
 * @param {number} [padLength=4]
 * @returns {Promise<string>} e.g. "INV-ADV-0001", "L-DL-0007"
 */
export async function generateAtomicId(prefix, padLength = 4) {
  const counterRef = doc(db, COLLECTIONS.COUNTERS, prefix);
  const nextNum = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const current = snap.exists() ? Number(snap.data().value) || 0 : 0;
    const next = current + 1;
    transaction.set(counterRef, { value: next }, { merge: true });
    return next;
  });
  return `${prefix}-${String(nextNum).padStart(padLength, '0')}`;
}

/**
 * Atomically generates the next sequential invoice number for the given
 * type. See generateAtomicId above for the collision-safety rationale.
 * @param {'Advance'|'Final'} type
 * @returns {Promise<string>} e.g. "INV-ADV-0001" / "INV-FIN-0001"
 */
export async function generateInvoiceId(type) {
  const prefix = type === 'Final' ? 'INV-FIN' : 'INV-ADV';
  return generateAtomicId(prefix, 4);
}

/**
 * Derives a receipt's id directly from the invoice it settles — a receipt
 * for "INV-ADV-0007" is "REC-ADV-0007". Deliberately NOT generated via
 * generateAtomicId/a counter: an independently-incremented receipt sequence
 * would desync from invoice numbers the moment even one invoice or receipt
 * is created out of lockstep with the other. Correctness here means
 * "matches the invoice," not "next in a sequence."
 * @param {string} invoiceId e.g. "INV-ADV-0007" or "INV-FIN-0002"
 * @returns {string} e.g. "REC-ADV-0007" — or "REC-<invoiceId>" if the
 *   invoice id doesn't match the expected INV-ADV/INV-FIN shape (an old,
 *   pre-Phase-10 invoice id format), so this never throws on legacy data.
 */
export function deriveReceiptId(invoiceId) {
  const id = String(invoiceId || '');
  if (id.startsWith('INV-ADV-')) return `REC-ADV-${id.slice('INV-ADV-'.length)}`;
  if (id.startsWith('INV-FIN-')) return `REC-FIN-${id.slice('INV-FIN-'.length)}`;
  return `REC-${id}`;
}
