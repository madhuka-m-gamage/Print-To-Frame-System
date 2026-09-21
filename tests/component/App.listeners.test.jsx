import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { PermissionsProvider, DEFAULT_PERMISSIONS } from '@/context/PermissionsContext';

const authState = { callback: null, role: 'Sales' };

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
  collection: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ identifier: 'user@example.com', name: 'User', role: authState.role, isApproved: true, status: 'Active' }) })),
  getDocs: vi.fn(async () => ({ docs: [], forEach: () => {} })),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  onSnapshot: vi.fn((_ref, onNext) => {
    onNext({ exists: () => true, data: () => globalThis.__TEST_PERMISSIONS__, docs: [], forEach: () => {}, size: 0 });
    return () => {};
  }),
}));
vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: new Proxy({}, { get: (_t, key) => String(key).toLowerCase() }),
  subscribeToCollection: vi.fn(() => () => {}),
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
const { subscribeToCollection } = await import('@/services/firestoreSync');
const { collection } = await import('firebase/firestore');

const listenersFor = async (role) => {
  authState.role = role;
  subscribeToCollection.mockClear();
  collection.mockClear();
  render(<PermissionsProvider><App /></PermissionsProvider>);
  await waitFor(() => expect(authState.callback).toBeTruthy());
  await act(async () => { await authState.callback({ email: 'user@example.com', displayName: 'User' }, 'token'); });
  await waitFor(() => expect(subscribeToCollection).toHaveBeenCalled());
  return new Set(subscribeToCollection.mock.calls.map(([name]) => name));
};

beforeEach(() => {
  globalThis.__TEST_PERMISSIONS__ = DEFAULT_PERMISSIONS;
  localStorage.clear();
});

describe('App Firestore listeners follow the role permissions', () => {
  it('does not open customers, partners, leads, quotations or receipts listeners for a Customer', async () => {
    const opened = await listenersFor('Customer');
    for (const name of ['customers', 'partners', 'leads', 'quotations', 'receipts', 'partner_applications']) {
      expect(opened.has(name), name).toBe(false);
    }
    for (const name of ['invoices', 'projects', 'logistics']) expect(opened.has(name), name).toBe(true);
  });

  it('opens the CRM listeners, including quotations, for Sales, but not partner applications', async () => {
    const opened = await listenersFor('Sales');
    for (const name of ['customers', 'partners', 'leads', 'quotations', 'invoices', 'receipts']) {
      expect(opened.has(name), name).toBe(true);
    }
    expect(opened.has('partner_applications')).toBe(false);
  });

  it('opens every listener for an Admin, partner applications included', async () => {
    const opened = await listenersFor('Admin');
    for (const name of ['customers', 'partners', 'projects', 'logistics', 'leads', 'invoices', 'receipts', 'quotations', 'partner_applications']) {
      expect(opened.has(name), name).toBe(true);
    }
  });

  it('lists the users collection only for roles that manage users or use messaging', async () => {
    const collectionNames = () => collection.mock.calls.map(([, name]) => name);
    await listenersFor('Sales');
    expect(collectionNames()).toContain('users');
    await listenersFor('Partner');
    expect(collectionNames()).not.toContain('users');
  });

  it('opens the pending sign-up listener for Admin and for roles that can edit users, not for Sales', async () => {
    const collectionNames = () => collection.mock.calls.map(([, name]) => name);
    await listenersFor('Manager');
    expect(collectionNames()).toContain('pending_users');
    await listenersFor('Sales');
    expect(collectionNames()).not.toContain('pending_users');
  });
});
