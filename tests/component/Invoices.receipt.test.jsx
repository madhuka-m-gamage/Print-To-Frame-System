import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeInvoice } from '../helpers/factories';

vi.mock('../../src/services/firestoreSync', () => ({
  COLLECTIONS: { INVOICES: 'invoices', LEADS: 'leads' },
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
}));
vi.mock('../../src/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('../../src/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));

const { default: Invoices } = await import('../../src/components/crm/Invoices');

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

beforeEach(() => vi.clearAllMocks());

describe('Invoices receipt form', () => {
  it('shows the invoice amount read-only and forwards the notes with the receipt', async () => {
    const invoice = makeInvoice({ id: 'INV-ADV-0001', type: 'Advance', status: 'Paid', amount: 75000, customerName: 'Kasun Perera' });
    const onGenerateReceipt = vi.fn(async () => {});
    renderWithProviders(
      <Invoices invoices={[invoice]} setInvoices={vi.fn()} currentUser={admin} receipts={[]} onGenerateReceipt={onGenerateReceipt} onMarkPaid={vi.fn()} />,
      { role: 'Admin' }
    );
    fireEvent.click(screen.getAllByText('INV-ADV-0001')[0]);
    fireEvent.click(await screen.findByRole('button', { name: /Generate Receipt/i }));

    const amount = screen.getByDisplayValue('75000');
    expect(amount).toHaveAttribute('readonly');
    fireEvent.change(screen.getByPlaceholderText('Optional'), { target: { value: 'Ref 4471' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(onGenerateReceipt).toHaveBeenCalledTimes(1));
    expect(onGenerateReceipt.mock.calls[0][1]).toMatchObject({ amountReceived: 75000, notes: 'Ref 4471' });
  });
});
