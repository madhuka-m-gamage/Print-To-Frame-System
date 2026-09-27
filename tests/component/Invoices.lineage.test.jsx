import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeInvoice } from '../helpers/factories';

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

const { default: Invoices } = await import('@/features/invoicing/Invoices');

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

describe('Invoices lead reference (MON-3)', () => {
  it('prints the whole lead lineage when the invoice carries the original lead id', async () => {
    const invoice = makeInvoice({ id: 'INV-ADV-0001', type: 'Advance', status: 'Pending', leadId: 'L-1', jobNo: '', linkedJobNo: '' });
    const leads = [
      { id: 'L-1', convertedDealId: 'D-1' },
      { id: 'D-1', isDeal: true, originalLeadId: 'L-1' },
    ];
    renderWithProviders(
      <Invoices invoices={[invoice]} leads={leads} setInvoices={vi.fn()} currentUser={admin} receipts={[]} onGenerateReceipt={vi.fn()} onMarkPaid={vi.fn()} />,
      { role: 'Admin' }
    );
    fireEvent.click(screen.getAllByText('INV-ADV-0001')[0]);
    expect(await screen.findByText(/Lead: D-1 \/ L-1/)).toBeInTheDocument();
  });
});
