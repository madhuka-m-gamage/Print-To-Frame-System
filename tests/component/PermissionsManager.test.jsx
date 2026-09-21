import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { DEFAULT_PERMISSIONS } from '@/context/PermissionsContext';

vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));

const { default: PermissionsManager } = await import('@/features/admin/PermissionsManager');
const { setDoc } = await import('firebase/firestore');

const admin = { role: 'Admin', identifier: 'admin@example.com', name: 'Admin' };

// A matrix saved before quotations and receipts existed, with one deliberate local tweak.
const legacyMatrix = () => {
  const m = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
  for (const role of Object.keys(m)) { delete m[role].quotations; delete m[role].receipts; }
  m.Support.leads = { view: true, create: true, edit: true, delete: false, export: false };
  return m;
};

beforeEach(() => vi.clearAllMocks());

describe('PermissionsManager missing modules', () => {
  it('does not offer the button when the saved matrix already has every module', () => {
    renderWithProviders(<PermissionsManager currentUser={admin} />, { role: 'Admin' });
    expect(screen.queryByRole('button', { name: /missing module/i })).not.toBeInTheDocument();
  });

  it('names the missing modules and adds their defaults without touching existing cells', async () => {
    renderWithProviders(<PermissionsManager currentUser={admin} />, { role: 'Admin', permissions: legacyMatrix() });
    fireEvent.click(await screen.findByRole('button', { name: /Add 2 missing modules with defaults/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    const saved = setDoc.mock.calls.at(-1)[1];
    expect(saved.Sales.quotations).toEqual(DEFAULT_PERMISSIONS.Sales.quotations);
    expect(saved.Sales.receipts).toEqual(DEFAULT_PERMISSIONS.Sales.receipts);
    expect(saved.Manager.receipts.delete).toBe(false);
    expect(saved.Support.leads).toEqual({ view: true, create: true, edit: true, delete: false, export: false });
  });
});
