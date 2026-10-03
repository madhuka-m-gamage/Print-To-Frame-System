import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { PermissionsProvider, DEFAULT_PERMISSIONS } from '@/context/PermissionsContext';

// SEC-15: a pending request is written only once the email is verified. Sign-up sends the
// verification mail and parks the form data in registrationDrafts/{uid}; the first verified
// sign-in turns that draft into the pendingUsers request.

const FORM = { identifier: 'New@Example.com ', password: 'secret1', name: 'Nimal', mobile: '0771234567', role: 'Partner', company: '' };
const NEW_USER = { uid: 'uid-new', email: 'new@example.com', displayName: null, emailVerified: false };
const state = { callback: null, signedOut: null, docs: {} };

vi.mock('@/services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {},
  initAuth: vi.fn((cb, onSignedOut) => { state.callback = cb; state.signedOut = onSignedOut; return () => {}; }),
  logout: vi.fn(async () => {}),
  emailLogin: vi.fn(),
  emailRegister: vi.fn(async () => {
    // Creating the account signs the user in, so the auth listener fires mid-registration.
    await state.callback({ ...NEW_USER }, null);
    return { user: { ...NEW_USER } };
  }),
  sendVerificationEmail: vi.fn(async () => {}),
  handleFirestoreError: vi.fn(), OperationType: {},
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...parts) => ({ path: parts.join('/') })),
  collection: vi.fn((_db, name) => ({ path: name })),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  getDoc: vi.fn(async (ref) => ({ exists: () => ref.path in state.docs, data: () => state.docs[ref.path] })),
  getDocs: vi.fn(async () => ({ docs: [], forEach: () => {} })),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  onSnapshot: vi.fn((_ref, onNext) => {
    onNext({ exists: () => true, data: () => DEFAULT_PERMISSIONS, docs: [], forEach: () => {}, size: 0 });
    return () => {};
  }),
}));
vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: new Proxy(
    { USERS: 'users', PENDING_USERS: 'pendingUsers', REGISTRATION_DRAFTS: 'registrationDrafts' },
    { get: (t, key) => t[key] ?? String(key).toLowerCase() },
  ),
  subscribeToCollection: vi.fn(() => () => {}),
  subscribeToQuery: vi.fn(() => () => {}),
  addDocument: vi.fn(async () => {}), updateDocument: vi.fn(async () => {}), batchWrite: vi.fn(async () => {}),
  generateInvoiceId: vi.fn(async () => 'INV-ADV-0001'), deriveReceiptId: vi.fn((id) => `REC-${id}`),
  createDocumentIfAbsent: vi.fn(async () => {}),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('@/features/auth/Login', () => ({
  default: ({ onRegister, errorMsg, successMsg }) => (
    <div>
      <button onClick={() => onRegister({ ...FORM })}>register</button>
      <p>error: {errorMsg}</p>
      <p>success: {successMsg}</p>
    </div>
  ),
}));
vi.mock('@/features/messaging/MiniChatDrawer', () => ({ default: () => null }));
vi.mock('@/features/messaging/FloatingMessageToast', () => ({ default: () => null }));
vi.mock('@/features/messaging/MessagingContext', () => ({
  MessagingProvider: ({ children }) => children,
  useMessaging: () => ({ unreadCount: 0, unreadByChat: {}, conversations: [] }),
}));

const { default: App } = await import('@/App');
const { logout, sendVerificationEmail, emailRegister } = await import('@/services/firebase');
const { setDoc, deleteDoc } = await import('firebase/firestore');

const writesTo = (path) => setDoc.mock.calls.filter(([ref]) => ref.path === path).map(([, data]) => data);

const renderApp = async () => {
  render(<PermissionsProvider><App /></PermissionsProvider>);
  await waitFor(() => expect(state.callback).toBeTruthy());
  await act(async () => { state.signedOut(); });
};

const signIn = (user) => act(async () => { await state.callback(user, null); });

beforeEach(() => {
  state.callback = null;
  state.signedOut = null;
  state.docs = {};
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Email sign-up (SEC-15)', () => {
  it('sends the verification mail, parks the form data in a draft and writes no pending request', async () => {
    await renderApp();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'register' })); });

    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(emailRegister).toHaveBeenCalledWith('new@example.com', 'secret1');
    expect(sendVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({ uid: 'uid-new' }));
    const [draft] = writesTo('registrationDrafts/uid-new');
    expect(draft).toMatchObject({ identifier: 'new@example.com', name: 'Nimal', mobile: '0771234567', role: 'Partner' });
    expect(draft).not.toHaveProperty('password');
    expect(writesTo('pendingUsers/new@example.com')).toEqual([]);
    expect(await screen.findByText(/success: .*verif/i)).toBeTruthy();
  });
});

describe('First sign-in of a new email/password account (SEC-15)', () => {
  it('tells an unverified user to check their mail and writes no pending request', async () => {
    await renderApp();
    await signIn({ ...NEW_USER });

    expect(logout).toHaveBeenCalled();
    expect(sendVerificationEmail).toHaveBeenCalled();
    expect(writesTo('pendingUsers/new@example.com')).toEqual([]);
    expect(await screen.findByText(/error: .*verif/i)).toBeTruthy();
  });

  it('writes the pending request from the draft on the first verified sign-in, then drops the draft', async () => {
    state.docs['registrationDrafts/uid-new'] = {
      identifier: 'new@example.com', name: 'Nimal', mobile: '0771234567', role: 'Partner', company: '',
      uid: 'uid-other', isApproved: true,
    };
    await renderApp();
    await signIn({ ...NEW_USER, emailVerified: true });

    const [pending] = writesTo('pendingUsers/new@example.com');
    expect(pending).toMatchObject({ identifier: 'new@example.com', name: 'Nimal', mobile: '0771234567', role: 'Partner', status: 'Pending', uid: 'uid-new' });
    expect(pending).not.toHaveProperty('isApproved');
    expect(deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'registrationDrafts/uid-new' }));
    expect(logout).toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
    expect(await screen.findByText(/error: .*pending admin approval/i)).toBeTruthy();
  });
});

describe('Google first sign-in (SEC-15 leaves it unchanged)', () => {
  it('queues the usual Customer request for a verified Google account with no draft', async () => {
    await renderApp();
    await signIn({ uid: 'uid-g', email: 'g@example.com', displayName: 'Gayan', emailVerified: true });

    const [pending] = writesTo('pendingUsers/g@example.com');
    expect(pending).toMatchObject({ identifier: 'g@example.com', name: 'Gayan', role: 'Customer', status: 'Pending', uid: 'uid-g' });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
    expect(logout).toHaveBeenCalled();
  });
});
