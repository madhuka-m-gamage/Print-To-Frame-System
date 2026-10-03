import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act, screen, fireEvent } from '@testing-library/react';
import { PermissionsProvider, DEFAULT_PERMISSIONS } from '@/context/PermissionsContext';

// FEA-2 (partners D-11): marking the last invoice paid writes one persisted notification
// addressed to the referring partner, and no longer emits a local in-memory one.

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

const DATA = {
  partners: [{ _firestoreId: 'P-1', partnerId: 'P-1', name: 'Lanka Art Studio', email: 'studio@example.com', commissionRate: 30 }],
  leads: [{ _firestoreId: 'D-1', id: 'D-1', name: 'Client', partnerId: 'P-1', source: 'Referral', stage: 'Completed', isDeal: true, totalSqFt: 10, value: 1000 }],
  invoices: [
    { _firestoreId: 'INV-ADV-1', id: 'INV-ADV-1', leadId: 'D-1', type: 'Advance', status: 'Paid', createdAt: '2026-10-01T00:00:00.000Z' },
    { _firestoreId: 'INV-FIN-1', id: 'INV-FIN-1', leadId: 'D-1', type: 'Final', status: 'Unpaid', createdAt: '2026-10-02T00:00:00.000Z' },
  ],
};

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: new Proxy({}, { get: (_t, key) => String(key).toLowerCase() }),
  subscribeToCollection: vi.fn((name, cb) => { cb(DATA[name] || []); return () => {}; }),
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
vi.mock('@/features/dashboard/Dashboard', () => ({
  default: ({ setActiveTab }) => <button onClick={() => setActiveTab('invoices')}>open invoices</button>,
}));
vi.mock('@/features/invoicing/Invoices', () => ({
  default: ({ onMarkPaid }) => <button onClick={() => onMarkPaid('D-1', 'INV-FIN-1')}>mark final paid</button>,
}));

const { default: App } = await import('@/App');
const sync = await import('@/services/firestoreSync');
const { toast } = await import('@/shared/utils/toast');
vi.spyOn(toast, 'warning');

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__TEST_PERMISSIONS__ = DEFAULT_PERMISSIONS;
  DATA.partners[0].email = 'studio@example.com';
  localStorage.clear();
});

const markPaid = async () => {
  render(<PermissionsProvider><App /></PermissionsProvider>);
  await waitFor(() => expect(authState.callback).toBeTruthy());
  await act(async () => { await authState.callback({ email: 'sales@example.com', displayName: 'Sales' }, 'token'); });
  fireEvent.click(await screen.findByText('open invoices'));
  fireEvent.click(await screen.findByText('mark final paid'));
};

describe('commission cleared notification (FEA-2)', () => {
  it('writes one notification to the partner from findPartnerForLead, role Partner, unread', async () => {
    await markPaid();
    await waitFor(() => expect(sync.addDocument).toHaveBeenCalled());
    const calls = sync.addDocument.mock.calls.filter(([c, d]) => c === 'notifications' && d.type === 'commission');
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({
      recipientEmail: 'studio@example.com',
      targetRole: 'Partner',
      type: 'commission',
      leadId: 'D-1',
      read: false,
      createdBy: 'sales@example.com',
      title: expect.stringMatching(/Commission Eligible/),
      message: expect.stringContaining('LKR 300.00'),
    });
  });

  it('does not also add a local in-memory commission notification for the signed-in user', async () => {
    await markPaid();
    await waitFor(() => expect(sync.addDocument).toHaveBeenCalled());
    fireEvent.click((await screen.findAllByLabelText('Notifications'))[0]);
    expect(screen.queryByText(/Commission Eligible/)).not.toBeInTheDocument();
  });

  it('warns the staff member and stores nothing when the partner has no email (FEA-18)', async () => {
    DATA.partners[0].email = '';
    await markPaid();
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/no email/i)));
    expect(sync.addDocument.mock.calls.filter(([c, d]) => c === 'notifications' && d.type === 'commission')).toHaveLength(0);
  });
});
