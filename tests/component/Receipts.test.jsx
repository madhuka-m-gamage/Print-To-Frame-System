import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeReceipt } from '../helpers/factories';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { RECEIPTS: 'receipts' },
  deleteDocument: vi.fn(async () => {}),
}));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('@/shared/utils/csvExport', () => ({ exportToCsv: vi.fn() }));

const { default: Receipts } = await import('@/features/invoicing/Receipts');
const { exportToCsv } = await import('@/shared/utils/csvExport');
const { toast } = await import('@/shared/utils/toast');

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

beforeEach(() => vi.clearAllMocks());

describe('Receipts CSV export', () => {
  it('disables Export CSV when there are no receipts', () => {
    renderWithProviders(<Receipts receipts={[]} currentUser={admin} />);
    const button = screen.getByRole('button', { name: /Export CSV/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(exportToCsv).not.toHaveBeenCalled();
  });

  it('exports the listed receipts and confirms with a toast', () => {
    renderWithProviders(<Receipts receipts={[makeReceipt({ id: 'REC-ADV-0001' })]} currentUser={admin} />);
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    expect(exportToCsv).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/Exported 1 receipts/));
  });

  it('shows an error toast instead of crashing when the export throws', () => {
    exportToCsv.mockImplementationOnce(() => { throw new Error('blocked'); });
    renderWithProviders(<Receipts receipts={[makeReceipt({ id: 'REC-ADV-0001' })]} currentUser={admin} />);
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Could not export receipts: blocked/));
  });
});
