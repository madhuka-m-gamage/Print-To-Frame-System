import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { CUSTOMERS: 'customers', USERS: 'users' },
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  setDocument: vi.fn(async () => {}),
  generateAtomicId: vi.fn(async (prefix) => `${prefix}-0001`),
}));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('@/features/customers/ContactSyncModal', () => ({ default: () => null }));

const { default: Customers } = await import('@/features/customers/Customers');

const renderAs = (identifier) => renderWithProviders(
  <Customers customers={[]} setCustomers={vi.fn()} users={[]} setUsers={vi.fn()} currentUser={{ role: 'Admin', name: 'Admin', identifier }} />,
  { role: 'Admin' }
);

describe('Customers Google Contacts sync (DEC-8)', () => {
  it('is offered to the super admin', () => {
    renderAs('madhukagamage6@gmail.com');
    expect(screen.getByTitle('Sync Google Contacts & WhatsApp')).toBeInTheDocument();
  });

  it('is hidden from any other Admin', () => {
    renderAs('admin@example.com');
    expect(screen.queryByTitle('Sync Google Contacts & WhatsApp')).not.toBeInTheDocument();
  });
});
