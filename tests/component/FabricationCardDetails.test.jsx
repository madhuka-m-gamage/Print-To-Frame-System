import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeProject } from '../helpers/factories';

vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('@/components/common/FrameBlueprintPreview', () => ({ default: () => null }));

const { default: FabricationCardDetails } = await import('@/components/operations/FabricationCardDetails');

const render = (job) => renderWithProviders(
  <FabricationCardDetails job={makeProject({ jobNo: 'PTF-1', status: 'Ongoing', value: 250000, ...job })} onClose={vi.fn()} onSave={vi.fn()} customers={[]} />,
  { role: 'Operations' }
);

describe('FabricationCardDetails (Phase 7 6.4c)', () => {
  it('shows no contract value to the fabrication team', () => {
    render({});
    expect(screen.queryByText(/Contract Value/i)).toBeNull();
    expect(screen.queryByText(/250,000/)).toBeNull();
  });

  it('ignores a click on the QC sign-off milestone', () => {
    render({});
    expect(screen.getByText(/0\/5 Complete/)).toBeTruthy();
    fireEvent.click(screen.getByText(/5\. Quality Control Sign-Off/));
    expect(screen.getByText(/0\/5 Complete/)).toBeTruthy();
    fireEvent.click(screen.getByText(/1\. Materials Requisitioned/));
    expect(screen.getByText(/1\/5 Complete/)).toBeTruthy();
  });

  it('makes the size read-only when it came from the lead', () => {
    render({ dimensionsLocked: true, frameWidth: 1219, frameHeight: 914 });
    expect(screen.getByDisplayValue('1219')).toHaveProperty('readOnly', true);
    expect(screen.getByDisplayValue('914')).toHaveProperty('readOnly', true);
  });
});
