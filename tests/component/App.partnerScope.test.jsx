import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { PermissionsProvider, DEFAULT_PERMISSIONS } from '@/context/PermissionsContext';

// SEC-8: the rules let a Partner read only the leads naming its partners record and those
// leads' invoices, so App must query exactly those, never the whole collections.

const authState = { callback: null, role: 'Partner' };

vi.mock('@/services/firebase', () => ({
  db: {},
  auth: { currentUser: null },
  storage: {},
  initAuth: vi.fn((cb) => { authState.callback = cb; return () => {}; }),
  logout: vi.fn(async () => {}),
  emailLogin: vi.fn(),
  emailRegister: vi.fn(),
  handleFirestoreError: vi.fn(),
  OperationType: {},
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  collection: vi.fn((_db, name) => ({ name })),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ identifier: 'own@example.com', name: 'Own', role: authState.role, isApproved: true, status: 'Active' }) })),
  getDocs: vi.fn(async () => ({ docs: [], forEach: () => {} })),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  onSnapshot: vi.fn((_ref, onNext) => {
    onNext({ exists: () => true, data: () => globalThis.__TEST_PERMISSIONS__, docs: [], forEach: () => {}, size: 0 });
    return () => {};
  }),
}));

const QUERY_RESULTS = {
  'partners email own@example.com': [{ _firestoreId: 'P-1', partnerId: 'P-1', email: 'own@example.com', name: 'Own Studio' }],
  'leads partnerId P-1': [{ _firestoreId: 'L-1', id: 'L-1', partnerId: 'P-1', agentId: 'P-1' }],
  'leads agentId P-1': [{ _firestoreId: 'L-1', id: 'L-1', partnerId: 'P-1', agentId: 'P-1' }, { _firestoreId: 'L-2', id: 'L-2', agentId: 'P-1' }],
};

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: new Proxy({}, { get: (_t, key) => String(key).toLowerCase() }),
  subscribeToCollection: vi.fn(() => () => {}),
  subscribeToQuery: vi.fn((q, callback) => {
    const [c] = q.constraints;
    callback(QUERY_RESULTS[`${q.ref.name} ${c.field} ${c.value}`] || []);
    return () => {};
  }),
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  batchWrite: vi.fn(async () => {}),
  generateInvoiceId: vi.fn(async () => 'INV-ADV-0001'),
  deriveReceiptId: vi.fn((id) => `REC-${id}`),
  createDocumentIfAbsent: vi.fn(async () => {}),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('@/features/auth/Login', () => ({ default: () => <div>login screen</div> }));
vi.mock('@/features/messaging/MiniChatDrawer', () => ({ default: () => null }));
vi.mock('@/features/messaging/FloatingMessageToast', () => ({ default: () => null }));
vi.mock('@/features/messaging/MessagingContext', () => ({
  MessagingProvider: ({ children }) => children,
  useMessaging: () => ({ unreadCount: 0, unreadByChat: {}, conversations: [] }),
}));

const { default: App } = await import('@/App');
const { subscribeToCollection, subscribeToQuery } = await import('@/services/firestoreSync');

const signIn = async (role) => {
  authState.role = role;
  subscribeToCollection.mockClear();
  subscribeToQuery.mockClear();
  render(<PermissionsProvider><App /></PermissionsProvider>);
  await waitFor(() => expect(authState.callback).toBeTruthy());
  await act(async () => { await authState.callback({ email: 'own@example.com', displayName: 'Own' }, 'token'); });
};

const queryKeys = () => subscribeToQuery.mock.calls.map(([q]) =>
  q.constraints.map((c) => `${q.ref.name} ${c.field} ${c.op} ${c.value}`).join(' & '));

beforeEach(() => {
  globalThis.__TEST_PERMISSIONS__ = DEFAULT_PERMISSIONS;
  localStorage.clear();
});

describe('App scopes a Partner to its referred leads and their invoices (SEC-8)', () => {
  it('queries leads by its partners record id in partnerId and agentId, then invoices per lead', async () => {
    await signIn('Partner');
    await waitFor(() => expect(queryKeys()).toEqual(expect.arrayContaining([
      'leads partnerId == P-1',
      'leads agentId == P-1',
      'invoices leadId == L-1',
      'invoices leadId == L-2',
    ])));
    const collections = subscribeToCollection.mock.calls.map(([name]) => name);
    expect(collections).not.toContain('leads');
    expect(collections).not.toContain('invoices');
  });

  it('opens no scoped lead or invoice query for staff', async () => {
    await signIn('Sales');
    await waitFor(() => expect(subscribeToCollection.mock.calls.map(([name]) => name)).toContain('leads'));
    expect(queryKeys().some((k) => k.startsWith('leads') || k.startsWith('invoices'))).toBe(false);
  });
});
