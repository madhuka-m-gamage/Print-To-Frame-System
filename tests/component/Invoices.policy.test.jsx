import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeInvoice, makeReceipt } from '../helpers/factories';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { INVOICES: 'invoices', LEADS: 'leads' },
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
}));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));

const { default: Invoices } = await import('@/components/crm/Invoices');
const sync = await import('@/services/firestoreSync');
const { toast } = await import('@/shared/utils/toast');

beforeEach(() => vi.clearAllMocks());

const open = (role, { invoice = makeInvoice({ id: 'INV-ADV-0001', type: 'Advance', status: 'Unpaid', amount: 75000 }), receipts = [] } = {}) => {
  const user = { role, name: role, firstName: role, lastName: 'User', identifier: `${role}@example.com` };
  renderWithProviders(
    <Invoices invoices={[invoice]} setInvoices={vi.fn()} currentUser={user} receipts={receipts} onGenerateReceipt={vi.fn()} onMarkPaid={vi.fn()} />,
    { role }
  );
  fireEvent.click(screen.getAllByText(invoice.id)[0]);
};

describe('Invoices edit policy', () => {
  it('locks the type and lets an Admin change the amount', async () => {
    open('Admin');
    fireEvent.click(await screen.findByTitle('Edit Invoice'));
    expect(screen.getByDisplayValue('Advance (75%)')).toBeDisabled();
    expect(screen.getByDisplayValue('75000')).not.toHaveAttribute('readonly');
  });

  it('makes the amount read-only for a Sales user and never sends amount or type on save', async () => {
    open('Sales');
    fireEvent.click(await screen.findByTitle('Edit Invoice'));
    expect(screen.getByDisplayValue('75000')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalled());
    const fields = sync.updateDocument.mock.calls[0][2];
    expect(fields).not.toHaveProperty('amount');
    expect(fields).not.toHaveProperty('type');
  });
});

describe('Invoices delete and cancel', () => {
  it('blocks deleting an invoice that has a receipt', async () => {
    open('Admin', { invoice: makeInvoice({ id: 'INV-ADV-0002', type: 'Advance', status: 'Paid', amount: 75000 }), receipts: [makeReceipt({ id: 'REC-ADV-0002', invoiceId: 'INV-ADV-0002' })] });
    fireEvent.click(await screen.findByTitle('Delete Invoice'));
    fireEvent.click(await screen.findByRole('button', { name: /Delete Permanently/i }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/has a receipt/)));
    expect(sync.deleteDocument).not.toHaveBeenCalled();
  });

  it('deletes an invoice that has no receipt', async () => {
    open('Admin');
    fireEvent.click(await screen.findByTitle('Delete Invoice'));
    fireEvent.click(await screen.findByRole('button', { name: /Delete Permanently/i }));
    await waitFor(() => expect(sync.deleteDocument).toHaveBeenCalledWith('invoices', expect.anything()));
  });

  it('cancels an unpaid invoice by setting its status, and offers no cancel on a paid one', async () => {
    open('Admin');
    fireEvent.click(await screen.findByTitle('Cancel Invoice'));
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledWith('invoices', expect.anything(), { status: 'Cancelled' }));
  });
});
