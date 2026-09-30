import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('@/services/firestoreSync', () => ({ COLLECTIONS: { CUSTOMERS: 'customers', PARTNERS: 'partners' } }));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));

const { default: UserProfile } = await import('@/features/profile/UserProfile');

const sales = { identifier: 'sales@example.com', name: 'Sales User', role: 'Sales', status: 'Active' };

describe('UserProfile jump links', () => {
  // employees D7: the "Execution Plan" link opened a `roadmap` tab that does not exist.
  it('has no Execution Plan link, and the other jump links still navigate', () => {
    const setActiveTab = vi.fn();
    renderWithProviders(<UserProfile currentUser={sales} setActiveTab={setActiveTab} />, { role: 'Sales' });
    fireEvent.click(screen.getByText('Department & Duties'));

    expect(screen.queryByText('Execution Plan')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Fabrication Works'));
    expect(setActiveTab).toHaveBeenCalledWith('projects');
    expect(setActiveTab).not.toHaveBeenCalledWith('roadmap');
  });
});
