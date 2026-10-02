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
vi.mock('@/features/logistics/LogisticsCardDetails', () => ({ default: () => null }));

const sync = await import('@/services/firestoreSync');
const { toast } = await import('@/shared/utils/toast');
const { default: Logistics } = await import('@/features/logistics/Logistics');

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

describe('Logistics fleet pickers (FEA-4)', () => {
  const openForm = () => {
    renderWithProviders(
      <Logistics jobs={[]} setJobs={vi.fn()} currentUser={admin} customers={[]} projects={[]} setProjects={vi.fn()} invoices={[]} partners={[]} />,
      { role: 'Admin' }
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Add|New|Schedule/i })[0]);
  };

  it('offers the drivers and vehicles from settings/fleet when the document exists', () => {
    globalThis.__TEST_FLEET__ = {
      vehicles: [{ id: 'v1', name: 'Tuk Cargo (WP TK 1)', type: 'Tuk', capacity: 'Small' }],
      drivers: [{ name: 'Ravi (Driver)', phone: '0771111111', role: 'Driver' }],
    };
    openForm();
    const options = screen.getAllByRole('option').map((o) => o.value);
    expect(options).toContain('Ravi (Driver)');
    expect(options).toContain('Tuk Cargo (WP TK 1)');
    expect(options).not.toContain('Sunil (Driver)');
  });

  it('falls back to the built-in lists when settings/fleet is missing', () => {
    openForm();
    const options = screen.getAllByRole('option').map((o) => o.value);
    expect(options).toContain('Sunil (Driver)');
    expect(options).toContain('Lorry (WP GE 1234)');
  });
});

describe('Logistics Cancelled project guard (DEC-4)', () => {
  it('does not offer a Cancelled work order for a new delivery', () => {
    const live = makeProject({ jobNo: 'PTF-0001', status: 'Completed', customerName: 'Live Client' });
    const cancelled = makeProject({ jobNo: 'PTF-0002', status: 'Cancelled', customerName: 'Gone Client' });
    renderWithProviders(
      <Logistics jobs={[]} setJobs={vi.fn()} currentUser={admin} customers={[]} projects={[live, cancelled]} setProjects={vi.fn()} invoices={[]} partners={[]} />,
      { role: 'Admin' }
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Add|New|Schedule/i })[0]);
    const options = screen.getAllByRole('option').map((o) => o.value);
    expect(options).toContain('PTF-0001');
    expect(options).not.toContain('PTF-0002');
  });
});
