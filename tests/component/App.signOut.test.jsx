import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PermissionsProvider, DEFAULT_PERMISSIONS } from '../../src/context/PermissionsContext';

const adminUser = { identifier: 'admin@example.com', name: 'Admin User', role: 'Admin', isApproved: true, status: 'Active' };
const authState = { callback: null };

vi.mock('../../src/services/firebase', () => ({
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
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ ...adminUser }) })),
  getDocs: vi.fn(async () => ({ docs: [], forEach: () => {} })),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  onSnapshot: vi.fn((_ref, onNext) => {
    onNext({ exists: () => true, data: () => globalThis.__TEST_PERMISSIONS__, docs: [], forEach: () => {}, size: 0 });
    return () => {};
  }),
}));
vi.mock('../../src/services/firestoreSync', () => ({
  COLLECTIONS: new Proxy({}, { get: (_t, key) => String(key).toLowerCase() }),
  subscribeToCollection: vi.fn(() => () => {}),
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  batchWrite: vi.fn(async () => {}),
  generateInvoiceId: vi.fn(async () => 'INV-ADV-0001'),
  deriveReceiptId: vi.fn((id) => `REC-${id}`),
  createDocumentIfAbsent: vi.fn(async () => {}),
}));
vi.mock('../../src/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('../../src/components/auth/Login', () => ({ default: () => <div>login screen</div> }));
vi.mock('../../src/components/tools/MiniChatDrawer', () => ({ default: () => null }));
vi.mock('../../src/components/common/FloatingMessageToast', () => ({ default: () => null }));
vi.mock('../../src/context/MessagingContext', () => ({
  MessagingProvider: ({ children }) => children,
  useMessaging: () => ({ unreadCount: 0, unreadByChat: {}, conversations: [] }),
}));

const { default: App } = await import('../../src/App');
const { emitNotification } = await import('../../src/utils/events');

const bells = () => screen.queryAllByLabelText('Notifications');

const signIn = async () => {
  await act(async () => { await authState.callback({ email: 'admin@example.com', displayName: 'Admin User' }, 'token'); });
};

beforeEach(() => {
  globalThis.__TEST_PERMISSIONS__ = DEFAULT_PERMISSIONS;
  localStorage.clear();
});

describe('App sign-out', () => {
  // Flipped in Phase 7 1 (notifications NOTIF-01): handleSignOut now clears the
  // notification list and unread count, so the next user starts clean.
  it('clears the previous user\'s unread notification count on sign-out', async () => {
    render(<PermissionsProvider><App /></PermissionsProvider>);
    await waitFor(() => expect(authState.callback).toBeTruthy());
    await signIn();

    await waitFor(() => expect(bells().length).toBeGreaterThan(0));
    act(() => { emitNotification({ title: 'Commission cleared', message: 'LKR 5,000 for Kasun', type: 'success' }); });
    await waitFor(() => expect(bells()[0]).toHaveTextContent('1'));

    fireEvent.click((await screen.findAllByText('Sign Out'))[0]);
    await waitFor(() => expect(bells()).toHaveLength(0));

    await signIn();
    await waitFor(() => expect(bells().length).toBeGreaterThan(0));
    expect(bells()[0]).not.toHaveTextContent('1');
  });
});
