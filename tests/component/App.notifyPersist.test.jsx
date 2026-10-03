import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { PermissionsProvider, DEFAULT_PERMISSIONS } from '@/context/PermissionsContext';

// FEA-7 (NOTIF-02, NOTIF-03): a plain toast leaves the notification centre alone; a toast marked
// `notify` is stored as a notification addressed to the signed-in user.

const authState = { callback: null };

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
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ identifier: 'sales@example.com', name: 'Sales', role: 'Sales', isApproved: true, status: 'Active' }) })),
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
  subscribeToCollection: vi.fn((_name, cb) => { cb([]); return () => {}; }),
  subscribeToQuery: vi.fn(() => () => {}),
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
vi.mock('@/features/dashboard/Dashboard', () => ({ default: () => <div>dashboard</div> }));
vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const { default: App } = await import('@/App');
const sync = await import('@/services/firestoreSync');
const { toast } = await import('@/shared/utils/toast');

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__TEST_PERMISSIONS__ = DEFAULT_PERMISSIONS;
  localStorage.clear();
});

const signIn = async () => {
  render(<PermissionsProvider><App /></PermissionsProvider>);
  await waitFor(() => expect(authState.callback).toBeTruthy());
  await act(async () => { await authState.callback({ email: 'sales@example.com', displayName: 'Sales' }, 'token'); });
  await waitFor(() => expect(document.body.textContent).toContain('dashboard'));
};

const notificationWrites = () => sync.addDocument.mock.calls.filter(([c]) => c === 'notifications');

describe('toast and the notification centre (FEA-7)', () => {
  it('a plain toast stores no notification', async () => {
    await signIn();
    act(() => { toast.success('Lead updated'); toast.error('Oops', { description: 'x' }); });
    expect(notificationWrites()).toHaveLength(0);
  });

  it('a toast marked notify is stored for the signed-in user in the FEA-2 shape', async () => {
    await signIn();
    act(() => { toast.success('Invoice fully settled', { description: 'Deal D-1', notify: true }); });
    await waitFor(() => expect(notificationWrites()).toHaveLength(1));
    expect(notificationWrites()[0][1]).toMatchObject({
      recipientEmail: 'sales@example.com',
      targetRole: 'Sales',
      type: 'success',
      title: 'Invoice fully settled',
      message: 'Deal D-1',
      read: false,
    });
  });

  it('does not pass the notify flag on to the toast library', async () => {
    const { toast: sonner } = await import('sonner');
    toast.success('Hi', { notify: true, description: 'd' });
    expect(sonner.success).toHaveBeenCalledWith('Hi', { description: 'd' });
  });
});
