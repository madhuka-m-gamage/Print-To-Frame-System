import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import { PermissionsProvider, DEFAULT_PERMISSIONS } from '@/context/PermissionsContext';

// internal-messaging D-MSG-03: the floating messenger, the message toast and the mobile
// dock's Messages button follow the messages permission.
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
vi.mock('@/features/messaging/MiniChatDrawer', () => ({ default: () => <div>quick messenger</div> }));
vi.mock('@/features/messaging/FloatingMessageToast', () => ({ default: () => <div>message toast</div> }));
vi.mock('@/features/messaging/MessagingContext', () => ({
  MessagingProvider: ({ children }) => children,
  useMessaging: () => ({ totalUnreadCount: 0 }),
}));

const { default: App } = await import('@/App');

const signInAs = async (role) => {
  authState.role = role;
  render(<PermissionsProvider><App /></PermissionsProvider>);
  await waitFor(() => expect(authState.callback).toBeTruthy());
  await act(async () => { await authState.callback({ email: 'user@example.com', displayName: 'User' }, 'token'); });
  await screen.findByRole('navigation', { name: 'Mobile Quick Dock' });
};

beforeEach(() => {
  globalThis.__TEST_PERMISSIONS__ = DEFAULT_PERMISSIONS;
  localStorage.clear();
});

describe('App messaging surfaces follow the messages permission', () => {
  it('mounts the quick messenger, the toast and the mobile Messages button for Sales', async () => {
    await signInAs('Sales');
    expect(screen.getByText('quick messenger')).toBeInTheDocument();
    expect(screen.getByText('message toast')).toBeInTheDocument();
    const dock = screen.getByRole('navigation', { name: 'Mobile Quick Dock' });
    expect(within(dock).getByRole('button', { name: 'Messages' })).toBeInTheDocument();
  });

  it('mounts none of them for a Customer, whose messages permission is none', async () => {
    await signInAs('Customer');
    expect(screen.queryByText('quick messenger')).not.toBeInTheDocument();
    expect(screen.queryByText('message toast')).not.toBeInTheDocument();
    const dock = screen.getByRole('navigation', { name: 'Mobile Quick Dock' });
    expect(within(dock).queryByRole('button', { name: 'Messages' })).not.toBeInTheDocument();
  });
});
