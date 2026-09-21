import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { PermissionsProvider, DEFAULT_PERMISSIONS } from '../../src/context/PermissionsContext';

const authState = { callback: null, ownRecord: null };

vi.mock('../../src/services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {},
  initAuth: vi.fn((cb) => { authState.callback = cb; return () => {}; }),
  logout: vi.fn(async () => {}),
  emailLogin: vi.fn(), emailRegister: vi.fn(), handleFirestoreError: vi.fn(), OperationType: {},
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...parts) => ({ path: parts.join('/') })),
  collection: vi.fn((_db, name) => ({ path: name })),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ identifier: 'user@example.com', name: 'User', role: 'Customer', isApproved: true, status: 'Active' }) })),
  getDocs: vi.fn(async () => ({ docs: [], forEach: () => {} })),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  onSnapshot: vi.fn((ref, onNext) => {
    if (ref.path === 'users/user@example.com') {
      if (authState.ownRecord) onNext({ exists: () => true, data: () => authState.ownRecord });
    } else {
      onNext({ exists: () => true, data: () => DEFAULT_PERMISSIONS, docs: [], forEach: () => {}, size: 0 });
    }
    return () => {};
  }),
}));
vi.mock('../../src/services/firestoreSync', () => ({
  COLLECTIONS: new Proxy({}, { get: (_t, key) => String(key).toLowerCase() }),
  subscribeToCollection: vi.fn(() => () => {}),
  addDocument: vi.fn(async () => {}), updateDocument: vi.fn(async () => {}), batchWrite: vi.fn(async () => {}),
  generateInvoiceId: vi.fn(async () => 'INV-ADV-0001'), deriveReceiptId: vi.fn((id) => `REC-${id}`),
  createDocumentIfAbsent: vi.fn(async () => {}),
}));
vi.mock('../../src/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('../../src/components/auth/Login', () => ({ default: ({ errorMsg }) => <div>login screen {errorMsg}</div> }));
vi.mock('../../src/components/tools/MiniChatDrawer', () => ({ default: () => null }));
vi.mock('../../src/components/common/FloatingMessageToast', () => ({ default: () => null }));
vi.mock('../../src/context/MessagingContext', () => ({
  MessagingProvider: ({ children }) => children,
  useMessaging: () => ({ unreadCount: 0, unreadByChat: {}, conversations: [] }),
}));

const { default: App } = await import('../../src/App');
const { logout } = await import('../../src/services/firebase');
const { logActivity } = await import('../../src/services/auditLog');

const signIn = async () => {
  render(<PermissionsProvider><App /></PermissionsProvider>);
  await waitFor(() => expect(authState.callback).toBeTruthy());
  await act(async () => { await authState.callback({ email: 'user@example.com', displayName: 'User' }, 'token'); });
};

beforeEach(() => {
  authState.callback = null;
  authState.ownRecord = null;
  logout.mockClear();
  logActivity.mockClear();
  localStorage.clear();
});

describe('Session eviction on deactivation (Phase 7 5.3, DP-04)', () => {
  it('signs the user out at once when their own record turns Deactivated', async () => {
    authState.ownRecord = { identifier: 'user@example.com', name: 'User', role: 'Customer', isApproved: true, status: 'Deactivated' };
    await signIn();
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('keeps an active user signed in and writes a LOGIN audit entry', async () => {
    authState.ownRecord = { identifier: 'user@example.com', name: 'User', role: 'Customer', isApproved: true, status: 'Active' };
    await signIn();
    await waitFor(() => expect(logActivity).toHaveBeenCalledWith('user@example.com', 'User', 'LOGIN', 'Auth', expect.any(String)));
    expect(logout).not.toHaveBeenCalled();
  });
});
