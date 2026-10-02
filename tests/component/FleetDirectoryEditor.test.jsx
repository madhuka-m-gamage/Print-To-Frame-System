import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { setDoc } from 'firebase/firestore';
import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));

const { default: FleetDirectoryEditor } = await import('@/features/admin/FleetDirectoryEditor');
const { toast } = await import('@/shared/utils/toast');

beforeEach(() => vi.clearAllMocks());

describe('FleetDirectoryEditor (FEA-4)', () => {
  it('starts from the built-in lists when settings/fleet is missing', () => {
    renderWithProviders(<FleetDirectoryEditor />);
    expect(screen.getByDisplayValue('Sunil (Driver)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lorry (WP GE 1234)')).toBeInTheDocument();
  });

  it('saves an added driver and a removed vehicle to settings/fleet', async () => {
    renderWithProviders(<FleetDirectoryEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Add driver/i }));
    const names = screen.getAllByPlaceholderText('Driver name');
    fireEvent.change(names[names.length - 1], { target: { value: 'Ravi (Driver)' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Remove vehicle/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save fleet/i }));

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [ref, data] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'settings/fleet' });
    expect(data.drivers.map((d) => d.name)).toContain('Ravi (Driver)');
    expect(data.vehicles.map((v) => v.name)).not.toContain('Lorry (WP GE 1234)');
    expect(data.vehicles).toHaveLength(2);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('tells the user when the save is refused', async () => {
    setDoc.mockRejectedValueOnce(new Error('permission-denied'));
    renderWithProviders(<FleetDirectoryEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Save fleet/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
