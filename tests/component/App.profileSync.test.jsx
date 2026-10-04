import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PermissionsProvider, DEFAULT_PERMISSIONS } from '@/context/PermissionsContext';

const partnerUser = {
  identifier: 'partner@example.com', name: 'Kasun Studio', role: 'Partner', partnerId: 'P-0001',
  isApproved: true, status: 'Active', contactNumber: '0772222222', location: 'Kandy', company: 'Kasun Frames',
};
const partnerRecord = { id: 'P-0001', _firestoreId: 'partner-doc-1', partnerId: 'P-0001', email: 'partner@example.com', name: 'Old Name', phone: '0711111111' };
const customerUser = {
  identifier: 'nimal@example.com', email: 'nimal@example.com', name: 'Nimal', role: 'Customer', nic: '912345678V',
  isApproved: true, status: 'Active', contactNumber: '', location: '',
};
const authState = { callback: null, user: null };

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
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ ...(authState.user || partnerUser) }) })),
  getDocs: vi.fn(async () => ({ docs: [{ id: 'customer-doc-1' }], forEach: () => {} })),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  onSnapshot: vi.fn((_ref, onNext) => {
    onNext({ exists: () => true, data: () => globalThis.__TEST_PERMISSIONS__, docs: [], forEach: () => {}, size: 0 });
    return () => {};
  }),
}));
vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: new Proxy({}, { get: (_t, key) => String(key).toLowerCase() }),
  subscribeToCollection: vi.fn(() => () => {}),
  subscribeToQuery: vi.fn((_q, setter) => {
    setter([partnerRecord]);
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
const { updateDocument, batchWrite } = await import('@/services/firestoreSync');

const partnerBatches = () => batchWrite.mock.calls.map(([ops]) => ops).filter((ops) => ops.some((op) => op.collection === 'partners'));
const { updateDoc, getDocs, where } = await import('firebase/firestore');
const { auth } = await import('@/services/firebase');

beforeEach(() => {
  globalThis.__TEST_PERMISSIONS__ = DEFAULT_PERMISSIONS;
  localStorage.clear();
  authState.user = null;
  auth.currentUser = null;
  vi.clearAllMocks();
});

describe('Partner profile save', () => {
  // profile-settings FINDINGS decision 2: handleUpdateUser in App.jsx is the one path
  // that mirrors a Partner's profile into partners; UserProfile.jsx no longer writes it.
  it('updates the partners record once, through handleUpdateUser, with phone, address and company, plus its public mirror (SEC-6)', async () => {
    render(<PermissionsProvider><App /></PermissionsProvider>);
    await waitFor(() => expect(authState.callback).toBeTruthy());
    await act(async () => { await authState.callback({ email: 'partner@example.com', displayName: 'Kasun Studio' }, 'token'); });

    fireEvent.click(await screen.findByTitle('My Profile'));
    fireEvent.click(await screen.findByText('Save Profile Changes'));

    await waitFor(() => expect(partnerBatches()).toHaveLength(1));
    expect(updateDocument.mock.calls.filter(([name]) => name === 'partners')).toHaveLength(0);
    const [partnerOp, publicOp] = partnerBatches()[0];
    expect(partnerOp).toMatchObject({ type: 'update', collection: 'partners', docId: 'partner-doc-1' });
    expect(partnerOp.data).toEqual(expect.objectContaining({
      name: 'Kasun Studio', contactPerson: 'Kasun Studio', phone: '0772222222', address: 'Kandy', company: 'Kasun Frames',
    }));
    expect(publicOp).toEqual({ type: 'set', collection: 'partner_public', docId: 'partner-doc-1', data: { name: 'Kasun Studio', status: 'Active', logo: '' } });
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe('Partner profile save, clearing fields', () => {
  it('writes an emptied phone, address and company to the partners record', async () => {
    authState.user = { ...partnerUser, contactNumber: '', location: '', company: '' };
    render(<PermissionsProvider><App /></PermissionsProvider>);
    await waitFor(() => expect(authState.callback).toBeTruthy());
    await act(async () => { await authState.callback({ email: 'partner@example.com', displayName: 'Kasun Studio' }, 'token'); });

    fireEvent.click(await screen.findByTitle('My Profile'));
    fireEvent.change(await screen.findByPlaceholderText('Kadawatha, Sri Lanka'), { target: { value: '' } });
    fireEvent.click(await screen.findByText('Save Profile Changes'));

    await waitFor(() => expect(partnerBatches()).toHaveLength(1));
    const [{ data: updates }] = partnerBatches()[0];
    expect(updates).toEqual(expect.objectContaining({ phone: '', address: '', company: '' }));
  });
});

describe('Customer profile save', () => {
  it('goes through handleUpdateUser: no direct customers write from UserProfile, and emptied fields are cleared', async () => {
    authState.user = customerUser;
    render(<PermissionsProvider><App /></PermissionsProvider>);
    await waitFor(() => expect(authState.callback).toBeTruthy());
    await act(async () => { await authState.callback({ email: 'nimal@example.com', displayName: 'Nimal' }, 'token'); });

    fireEvent.click(await screen.findByTitle('My Profile'));
    fireEvent.change(await screen.findByPlaceholderText('Kadawatha, Sri Lanka'), { target: { value: '' } });
    fireEvent.click(await screen.findByText('Save Profile Changes'));

    await waitFor(() => expect(updateDocument.mock.calls.some(([name]) => name === 'customers')).toBe(true));
    const customerWrites = updateDocument.mock.calls.filter(([name]) => name === 'customers');
    expect(customerWrites).toHaveLength(1);
    expect(customerWrites[0][1]).toBe('customer-doc-1');
    expect(customerWrites[0][2]).toEqual(expect.objectContaining({ name: 'Nimal', phone: '', address: '' }));
    expect(updateDoc).not.toHaveBeenCalled();
    // the rules let a client read only rows whose email matches their token, so the lookup is by email alone
    expect(where.mock.calls.filter(([field]) => field === 'nic')).toHaveLength(0);
    expect(getDocs).toHaveBeenCalled();
  });
});

describe('Customer profile save, linked by userId (FEA-15)', () => {
  const saveCustomerProfile = async () => {
    authState.user = customerUser;
    render(<PermissionsProvider><App /></PermissionsProvider>);
    await waitFor(() => expect(authState.callback).toBeTruthy());
    await act(async () => { await authState.callback({ email: 'nimal@example.com', displayName: 'Nimal', uid: 'uid-nimal' }, 'token'); });
    fireEvent.click(await screen.findByTitle('My Profile'));
    fireEvent.click(await screen.findByText('Save Profile Changes'));
    await waitFor(() => expect(updateDocument.mock.calls.some(([name]) => name === 'customers')).toBe(true));
    return updateDocument.mock.calls.filter(([name]) => name === 'customers');
  };

  it('finds the customers row by the login uid first, without an email lookup', async () => {
    auth.currentUser = { uid: 'uid-nimal', email: 'nimal@example.com' };
    getDocs.mockResolvedValueOnce({ docs: [{ id: 'customer-by-uid' }], empty: false, forEach: () => {} });

    const writes = await saveCustomerProfile();

    expect(where).toHaveBeenCalledWith('userId', '==', 'uid-nimal');
    expect(where.mock.calls.filter(([field]) => field === 'email')).toHaveLength(0);
    expect(writes).toHaveLength(1);
    expect(writes[0][1]).toBe('customer-by-uid');
  });

  it('falls back to the email lookup when no row carries the uid', async () => {
    auth.currentUser = { uid: 'uid-nimal', email: 'nimal@example.com' };
    getDocs.mockResolvedValueOnce({ docs: [], empty: true, forEach: () => {} });

    const writes = await saveCustomerProfile();

    expect(where).toHaveBeenCalledWith('userId', '==', 'uid-nimal');
    expect(where).toHaveBeenCalledWith('email', '==', 'nimal@example.com');
    expect(writes).toHaveLength(1);
    expect(writes[0][1]).toBe('customer-doc-1');
  });
});
