import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeProject, makeInvoice } from '../helpers/factories';

vi.mock('../../src/services/firestoreSync', () => ({
  COLLECTIONS: { PROJECTS: 'projects', LOGISTICS: 'logistics', INVOICES: 'invoices', LEADS: 'leads' },
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  generateInvoiceId: vi.fn(async () => 'INV-FIN-0001'),
  generateAtomicId: vi.fn(async (prefix) => `${prefix}-0001`),
}));
vi.mock('../../src/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('../../src/components/operations/FabricationCardDetails', () => ({ default: () => null }));
vi.mock('../../src/components/common/FrameBlueprintPreview', () => ({ default: () => null }));

const { generateInvoiceId, generateAtomicId } = await import('../../src/services/firestoreSync');
const { toast } = await import('../../src/utils/toast');
const { default: FabricationWorks } = await import('../../src/components/operations/FabricationWorks');

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

function renderFabrication(props = {}) {
  const project = makeProject({ jobNo: 'PTF-2001', title: 'Gallery Canvas', status: 'Ready For Inspection', value: 100000 });
  const setProjects = vi.fn();
  const onSaveInvoice = vi.fn();
  renderWithProviders(
    <FabricationWorks projects={[project]} setProjects={setProjects} customers={[]} partners={[]} currentUser={admin} onSaveInvoice={onSaveInvoice} {...props} />,
    { role: 'Admin' }
  );
  return { project, setProjects, onSaveInvoice };
}

beforeEach(() => vi.clearAllMocks());

describe('FabricationWorks QA pass wiring', () => {
  it('creates a 25% Final invoice when a job passes QA', async () => {
    const { onSaveInvoice } = renderFabrication();
    fireEvent.click(screen.getByTitle('Run QA Inspection Gate'));
    fireEvent.click(await screen.findByRole('button', { name: /Approve & Complete/i }));
    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalledTimes(1));
    expect(onSaveInvoice.mock.calls[0][0]).toMatchObject({ id: 'INV-FIN-0001', type: 'Final', status: 'Unpaid', jobNo: 'PTF-2001', amount: 25000, totalValue: 100000 });
  });

  // Flipped in Phase 7 2.1 (invoicing D-1, fabrication F-1): App passes invoices in,
  // so a job that already has a Final invoice passes QA without creating another.
  it('does not create another Final invoice when one already exists for the job', async () => {
    const existing = makeInvoice({ id: 'INV-FIN-0009', type: 'Final', jobNo: 'PTF-2001', linkedJobNo: 'PTF-2001' });
    const { onSaveInvoice, setProjects } = renderFabrication({ invoices: [existing] });
    fireEvent.click(screen.getByTitle('Run QA Inspection Gate'));
    fireEvent.click(await screen.findByRole('button', { name: /Approve & Complete/i }));
    await waitFor(() => expect(setProjects).toHaveBeenCalled());
    expect(generateInvoiceId).not.toHaveBeenCalled();
    expect(onSaveInvoice).not.toHaveBeenCalled();
  });
});

describe('FabricationWorks Completed-stage lock', () => {
  it('offers a backward move from Ongoing but not from Completed', () => {
    const ongoing = renderFabricationWith('Ongoing');
    expect(screen.queryByRole('button', { name: /backward/i })).toBeInTheDocument();
    ongoing.unmount();
    renderFabricationWith('Completed');
    expect(screen.queryByRole('button', { name: /backward/i })).not.toBeInTheDocument();
  });
});

function renderFabricationWith(status) {
  const project = makeProject({ jobNo: 'PTF-2002', title: 'Gallery Canvas', status });
  return renderWithProviders(
    <FabricationWorks projects={[project]} setProjects={vi.fn()} customers={[]} partners={[]} currentUser={admin} onSaveInvoice={vi.fn()} />,
    { role: 'Admin' }
  );
}

describe('FabricationWorks manual job billing link (Phase 7 6.4b, F-4)', () => {
  const deal = { id: 'D-0001', jobNo: 'PTF-0001', name: 'Client One', originalLeadId: 'L-0001', isDeal: true, pricingMetadata: { dimensions: { length: 4, height: 3 } } };

  const openForm = (props) => {
    const ctx = renderFabrication({ deals: [deal], ...props });
    fireEvent.click(screen.getByRole('button', { name: /New Job Request/i }));
    fireEvent.change(screen.getByPlaceholderText(/Box Iron Frame \(10' × 4'\)/), { target: { value: 'Extra brace work' } });
    return ctx;
  };

  it('has no price field and refuses a job that is neither linked to a deal nor non-billable', async () => {
    const { setProjects } = openForm();
    expect(screen.queryByText(/Total Job Value/i)).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /Generate Work Order/i }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/deal, or mark it non-billable/i));
    expect(setProjects).not.toHaveBeenCalled();
    expect(generateAtomicId).not.toHaveBeenCalled();
  });

  it('creates a non-billable internal job with no value', async () => {
    const { setProjects } = openForm();
    fireEvent.change(await screen.findByDisplayValue(/Select a deal or non-billable/i), { target: { value: 'NON_BILLABLE' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate Work Order/i }));
    await waitFor(() => expect(setProjects).toHaveBeenCalledTimes(1));
    expect(setProjects.mock.calls[0][0][0]).toMatchObject({ billable: false, origin: 'manual', value: 0 });
  });

  it('links extra work to a deal and locks the size it inherits', async () => {
    const { setProjects } = openForm();
    fireEvent.change(await screen.findByDisplayValue(/Select a deal or non-billable/i), { target: { value: 'D-0001' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate Work Order/i }));
    await waitFor(() => expect(setProjects).toHaveBeenCalledTimes(1));
    expect(setProjects.mock.calls[0][0][0]).toMatchObject({ dealId: 'D-0001', leadId: 'L-0001', billable: true, value: 0, dimensionsLocked: true, frameWidth: 1219, frameHeight: 914 });
  });
});
