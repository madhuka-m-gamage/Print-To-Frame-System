import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeLogisticsJob, makeInvoice } from '../helpers/factories';

vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));

const { default: LogisticsCardDetails } = await import('@/components/operations/LogisticsCardDetails');

const job = makeLogisticsJob({ id: 'L-DL-0001', linkedJobNo: 'PTF-0001', driver: 'Nimal' });
const finalInv = (o = {}) => makeInvoice({ type: 'Final', linkedJobNo: 'PTF-0001', ...o });

function renderCard({ invoices, canCollectCod = true, onCollectCod = vi.fn(async () => true) } = {}) {
  renderWithProviders(
    <LogisticsCardDetails job={job} onClose={vi.fn()} onSave={vi.fn()} invoices={invoices} customers={[]} projects={[]}
      canCollectCod={canCollectCod} onCollectCod={onCollectCod} collectorName="Dispatcher" />,
    { role: 'Admin' }
  );
  return { onCollectCod };
}

describe('LogisticsCardDetails cash on delivery (Phase 7 6.5b, D-6)', () => {
  it('asks for confirmation, then records the cash against the unpaid Final invoice', async () => {
    const inv = finalInv();
    const { onCollectCod } = renderCard({ invoices: [inv] });
    fireEvent.click(screen.getByRole('button', { name: /Record cash collection/i }));
    expect(onCollectCod).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Yes, cash collected/i }));
    await waitFor(() => expect(onCollectCod).toHaveBeenCalledTimes(1));
    expect(onCollectCod.mock.calls[0][0]).toMatchObject({ id: inv.id });
    expect(onCollectCod.mock.calls[0][1]).toEqual({ collectedBy: 'Nimal' });
  });

  it('hides the action from a role that cannot edit invoices and create receipts', () => {
    renderCard({ invoices: [finalInv()], canCollectCod: false });
    expect(screen.queryByRole('button', { name: /Record cash collection/i })).toBeNull();
  });

  it('offers nothing once the invoice is paid', () => {
    renderCard({ invoices: [finalInv({ status: 'Paid' })] });
    expect(screen.queryByRole('button', { name: /Record cash collection/i })).toBeNull();
  });

  it('asks for the Final invoice to be created first when only the Advance exists and is paid', () => {
    renderCard({ invoices: [makeInvoice({ type: 'Advance', status: 'Paid', linkedJobNo: 'PTF-0001', totalValue: 100000, amount: 75000 })] });
    expect(screen.queryByRole('button', { name: /Record cash collection/i })).toBeNull();
    expect(screen.getByText(/Create the 25% Final invoice first/i)).toBeTruthy();
  });
});
