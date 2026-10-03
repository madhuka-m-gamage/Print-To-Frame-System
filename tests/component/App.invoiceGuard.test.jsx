import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { PermissionsProvider, DEFAULT_PERMISSIONS } from '@/context/PermissionsContext';

// MON-4: handleSaveInvoice writes an Advance or Final invoice together with
// invoice_guards/<rootLeadId>_<type>, so a second one for the same lead is refused.

const authState = { callback: null };
const saved = { results: [] };

vi.mock('@/services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {},
  initAuth: vi.fn((cb) => { authState.callback = cb; return () => {}; }),
  logout: vi.fn(async () => {}),
  emailLogin: vi.fn(), emailRegister: vi.fn(), handleFirestoreError: vi.fn(), OperationType: {},
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...parts) => ({ path: parts.join('/') })),
  collection: vi.fn((_db, name) => ({ path: name })),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ identifier: 'sales@example.com', name: 'Sales', role: 'Sales', isApproved: true, status: 'Active' }) })),
  getDocs: vi.fn(async () => ({ docs: [], forEach: () => {} })),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  onSnapshot: vi.fn((_ref, onNext) => {
    onNext({ exists: () => true, data: () => DEFAULT_PERMISSIONS, docs: [], forEach: () => {}, size: 0 });
    return () => {};
  }),
}));
vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { INVOICES: 'invoices', INVOICE_GUARDS: 'invoice_guards', LEADS: 'leads' },
  subscribeToCollection: vi.fn(() => () => {}),
  addDocument: vi.fn(async () => {}), updateDocument: vi.fn(async () => {}), batchWrite: vi.fn(async () => {}),
  generateInvoiceId: vi.fn(async () => 'INV-ADV-0001'), deriveReceiptId: vi.fn((id) => `REC-${id}`),
  createDocumentIfAbsent: vi.fn(async () => {}),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('@/shared/utils/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/features/auth/Login', () => ({ default: () => <div>login screen</div> }));
vi.mock('@/features/messaging/MiniChatDrawer', () => ({ default: () => null }));
vi.mock('@/features/messaging/FloatingMessageToast', () => ({ default: () => null }));
vi.mock('@/features/messaging/MessagingContext', () => ({
  MessagingProvider: ({ children }) => children,
  useMessaging: () => ({ unreadCount: 0, unreadByChat: {}, conversations: [] }),
}));

const invoice = (overrides) => ({ leadId: 'L-001', dealId: '', amount: 750, totalValue: 1000, ...overrides });

vi.mock('@/features/leads/Leads', () => ({
  default: ({ onSaveInvoice }) => (
    <div>
      <button onClick={async () => saved.results.push(await onSaveInvoice(invoice({ id: 'INV-ADV-0001', type: 'Advance' })))}>save advance</button>
      <button onClick={async () => saved.results.push(await onSaveInvoice(invoice({ id: 'INV-FIN-0001', type: 'Final', leadId: 'L-001', dealId: 'D-001', originalLeadId: 'L-001' })))}>save final</button>
      <button onClick={async () => saved.results.push(await onSaveInvoice(invoice({ id: 'INV-0001', type: 'Custom' })))}>save other</button>
    </div>
  ),
}));

const { default: App } = await import('@/App');
const { createDocumentIfAbsent, addDocument } = await import('@/services/firestoreSync');
const { toast } = await import('@/shared/utils/toast');

const openLeads = async () => {
  render(<PermissionsProvider><App /></PermissionsProvider>);
  await waitFor(() => expect(authState.callback).toBeTruthy());
  await act(async () => { await authState.callback({ email: 'sales@example.com', displayName: 'Sales' }, 'token'); });
  fireEvent.click(await screen.findByRole('button', { name: /^Leads$/ }));
  await screen.findByText('save advance');
};

const click = async (label) => {
  const before = saved.results.length;
  fireEvent.click(screen.getByText(label));
  await waitFor(() => expect(saved.results.length).toBe(before + 1));
  return saved.results.at(-1);
};

beforeEach(() => {
  saved.results = [];
  createDocumentIfAbsent.mockReset();
  createDocumentIfAbsent.mockResolvedValue('ok');
  addDocument.mockClear();
  toast.error.mockClear();
});

describe('handleSaveInvoice guard (MON-4)', () => {
  it('writes an Advance invoice together with its <rootLeadId>_Advance guard', async () => {
    await openLeads();
    expect(await click('save advance')).toBe(true);
    expect(createDocumentIfAbsent).toHaveBeenCalledWith(
      'invoices', 'INV-ADV-0001', expect.objectContaining({ id: 'INV-ADV-0001', type: 'Advance' }),
      { collectionName: 'invoice_guards', docId: 'L-001_Advance', data: expect.objectContaining({ invoiceId: 'INV-ADV-0001', type: 'Advance', rootLeadId: 'L-001' }) },
    );
    expect(addDocument).not.toHaveBeenCalledWith('invoices', expect.anything(), expect.anything());
  });

  it('keys a Final from a Deal by the original lead', async () => {
    await openLeads();
    expect(await click('save final')).toBe(true);
    expect(createDocumentIfAbsent.mock.calls[0][3]).toMatchObject({ docId: 'L-001_Final' });
  });

  it('refuses a second Advance for the same lead with a clear message and no second write', async () => {
    createDocumentIfAbsent.mockRejectedValueOnce(new Error('ALREADY_EXISTS'));
    await openLeads();
    expect(await click('save advance')).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Advance invoice already exists for lead L-001/));
    expect(addDocument).not.toHaveBeenCalledWith('invoices', expect.anything(), expect.anything());
  });

  it('leaves other invoice types unguarded', async () => {
    await openLeads();
    expect(await click('save other')).toBe(true);
    expect(createDocumentIfAbsent).not.toHaveBeenCalled();
    expect(addDocument).toHaveBeenCalledWith('invoices', expect.objectContaining({ id: 'INV-0001' }), 'INV-0001');
  });
});
