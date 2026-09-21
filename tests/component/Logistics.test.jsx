import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeLogisticsJob, makeProject } from '../helpers/factories';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { LOGISTICS: 'logistics', PROJECTS: 'projects', INVOICES: 'invoices', COUNTERS: 'counters' },
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  generateAtomicId: vi.fn(async (prefix) => `${prefix}-0001`),
}));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('@/components/operations/LogisticsCardDetails', () => ({ default: () => null }));

const sync = await import('@/services/firestoreSync');
const { toast } = await import('@/shared/utils/toast');
const { default: Logistics } = await import('@/components/operations/Logistics');

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

function setup({ status = 'Pending', type = 'Delivery' } = {}) {
  const job = makeLogisticsJob({ id: 'L-DL-0001', status, type, linkedJobNo: 'PTF-0001' });
  const project = makeProject({ jobNo: 'PTF-0001', status: 'Completed' });
  const store = { jobs: [job] };
  const setJobs = vi.fn((next) => { store.jobs = typeof next === 'function' ? next(store.jobs) : next; });
  const setProjects = vi.fn();
  renderWithProviders(
    <Logistics jobs={[job]} setJobs={setJobs} currentUser={admin} customers={[]} projects={[project]} setProjects={setProjects} invoices={[]} partners={[]} />,
    { role: 'Admin' }
  );
  return { job, project, store, setJobs, setProjects };
}

beforeEach(() => vi.clearAllMocks());

describe('Logistics stage moves (Phase 7 6.5)', () => {
  it('reports in_transit to the linked project when a delivery is moved forward', async () => {
    const { project } = setup();
    fireEvent.click(screen.getAllByRole('button', { name: /Start Transit/i })[0]);
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledWith('projects', project._firestoreId || 'PTF-0001', { deliveryStatus: 'in_transit' }));
  });

  it('puts the card back and tells the user when the server refuses the move', async () => {
    const { store } = setup();
    sync.updateDocument.mockRejectedValueOnce(new Error('permission-denied'));
    fireEvent.click(screen.getAllByRole('button', { name: /Start Transit/i })[0]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to sync stage change to server'));
    expect(store.jobs[0].status).toBe('Pending');
  });

  it('does not touch the project for a pickup task', async () => {
    setup({ type: 'Pickup' });
    fireEvent.click(screen.getAllByRole('button', { name: /pickup/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /Start Transit/i })[0]);
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledTimes(1));
    expect(sync.updateDocument.mock.calls[0][0]).toBe('logistics');
  });
});
