import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeLead, makeLogisticsJob } from '../helpers/factories';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { LEADS: 'leads', LOGISTICS: 'logistics' },
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  generateAtomicId: vi.fn(async () => 'X-1'),
}));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));

const { default: Leads } = await import('@/features/leads/Leads');

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

describe('Leads logistics lookup (MON-3)', () => {
  it('shows the pickup as done when the job carries the converted deal id', () => {
    const lead = makeLead({ id: 'L-1', stage: '75% Invoice Submitted', convertedDealId: 'D-1' });
    const job = makeLogisticsJob({ leadId: 'D-1', status: 'Completed' });
    renderWithProviders(
      <Leads leads={[lead]} setLeads={vi.fn()} logisticsJobs={[job]} setLogisticsJobs={vi.fn()} setProjects={vi.fn()} currentUser={admin} />,
      { role: 'Admin' }
    );
    expect(screen.getByText('Picked Up')).toBeInTheDocument();
  });
});
