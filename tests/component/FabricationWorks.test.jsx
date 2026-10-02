import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeProject, makeInvoice } from '../helpers/factories';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { PROJECTS: 'projects', LOGISTICS: 'logistics', INVOICES: 'invoices', LEADS: 'leads' },
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  generateInvoiceId: vi.fn(async () => 'INV-FIN-0001'),
  generateAtomicId: vi.fn(async (prefix) => `${prefix}-0001`),
}));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('@/features/fabrication/FabricationCardDetails', () => ({ default: () => null }));
vi.mock('@/features/fabrication/FrameBlueprintPreview', () => ({ default: () => null }));

const { generateInvoiceId, generateAtomicId, updateDocument } = await import('@/services/firestoreSync');
const { toast } = await import('@/shared/utils/toast');
const { logActivity } = await import('@/services/auditLog');
const { default: FabricationWorks } = await import('@/features/fabrication/FabricationWorks');

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

  it('rounds the Final to the remainder after a cent-rounded Advance (MON-8)', async () => {
    const project = makeProject({ jobNo: 'PTF-2001', title: 'Gallery Canvas', status: 'Ready For Inspection', value: 33333.33 });
    const { onSaveInvoice } = renderFabrication({ projects: [project] });
    fireEvent.click(screen.getByTitle('Run QA Inspection Gate'));
    fireEvent.click(await screen.findByRole('button', { name: /Approve & Complete/i }));
    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalledTimes(1));
    expect(onSaveInvoice.mock.calls[0][0].amount).toBe(8333.33);
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

describe('FabricationWorks Cancelled project guard (DEC-4)', () => {
  it('refuses the QA pass and the Final invoice when the project was cancelled while the gate was open', async () => {
    const project = makeProject({ jobNo: 'PTF-2001', title: 'Gallery Canvas', status: 'Ready For Inspection', value: 100000 });
    const setProjects = vi.fn();
    const onSaveInvoice = vi.fn();
    const ui = (projects) => <FabricationWorks projects={projects} setProjects={setProjects} customers={[]} partners={[]} currentUser={admin} onSaveInvoice={onSaveInvoice} />;
    const { rerender } = renderWithProviders(ui([project]), { role: 'Admin' });
    fireEvent.click(screen.getByTitle('Run QA Inspection Gate'));
    const approve = await screen.findByRole('button', { name: /Approve & Complete/i });
    rerender(ui([{ ...project, status: 'Cancelled', cancelledReason: 'Deal D-0001 deleted' }]));
    fireEvent.click(approve);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('PTF-2001 is Cancelled (Deal D-0001 deleted), so no Final invoice can be created for it.'));
    expect(generateInvoiceId).not.toHaveBeenCalled();
    expect(onSaveInvoice).not.toHaveBeenCalled();
    expect(setProjects).not.toHaveBeenCalled();
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

describe('FabricationWorks QA gate (Phase 7 6.4c)', () => {
  const passQa = async () => {
    fireEvent.click(screen.getByTitle('Run QA Inspection Gate'));
    fireEvent.click(await screen.findByRole('button', { name: /Approve & Complete/i }));
  };

  it('does not mark the job Completed when the Final invoice could not be saved', async () => {
    const onSaveInvoice = vi.fn(async () => false);
    const { setProjects } = renderFabrication({ onSaveInvoice });
    await passQa();
    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalledTimes(1));
    expect(setProjects).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/NOT marked Completed/));
  });

  it('stamps the signed-in user as inspector, ignoring any typed name, and audit logs the pass', async () => {
    const { setProjects } = renderFabrication();
    fireEvent.click(screen.getByTitle('Run QA Inspection Gate'));
    expect(await screen.findByDisplayValue('Admin')).toHaveProperty('readOnly', true);
    fireEvent.click(screen.getByRole('button', { name: /Approve & Complete/i }));
    await waitFor(() => expect(setProjects).toHaveBeenCalled());
    expect(setProjects.mock.calls[0][0][0].qaCheck.inspector).toBe('Admin');
    expect(setProjects.mock.calls[0][0][0].defectDetails).toBeNull();
    await waitFor(() => expect(logActivity).toHaveBeenCalledWith('admin@example.com', 'Admin', 'QA_PASSED', 'Fabrication', expect.stringContaining('PTF-2001')));
  });

  it('carries the customer phone and company onto the Final invoice', async () => {
    const project = makeProject({ jobNo: 'PTF-2001', status: 'Ready For Inspection', value: 100000, customerPhone: '+94711111111', company: 'Job Co' });
    const onSaveInvoice = vi.fn();
    renderWithProviders(
      <FabricationWorks projects={[project]} setProjects={vi.fn()} customers={[]} partners={[]} currentUser={admin} onSaveInvoice={onSaveInvoice} />,
      { role: 'Admin' }
    );
    await passQa();
    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalled());
    expect(onSaveInvoice.mock.calls[0][0]).toMatchObject({ phone: '+94711111111', company: 'Job Co' });
  });
});

describe('FabricationWorks board statuses (FEA-3)', () => {
  const renderJobs = (jobs, props = {}) => {
    const setProjects = vi.fn();
    renderWithProviders(
      <FabricationWorks projects={jobs} setProjects={setProjects} customers={[]} partners={[]} currentUser={admin} onSaveInvoice={vi.fn()} {...props} />,
      { role: 'Admin' }
    );
    return { setProjects };
  };
  const job = (status, extra = {}) => makeProject({ jobNo: 'PTF-3001', title: 'Gallery Canvas', status, ...extra });

  it('shows a job with an unrecognised status under Other instead of hiding it', () => {
    renderJobs([job('Weird')]);
    expect(screen.getByRole('heading', { name: 'Other' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Inspect Gallery Canvas/ })).toBeInTheDocument();
  });

  it('shows a Cancelled job read-only with its reason and no stage moves', () => {
    renderJobs([job('Cancelled', { cancelledReason: 'Deal D-0001 deleted' })]);
    expect(screen.getByRole('heading', { name: 'Cancelled' })).toBeInTheDocument();
    expect(screen.getByText(/Deal D-0001 deleted/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /backward/i })).toBeNull();
    expect(screen.queryByTitle('Advance Stage')).toBeNull();
    expect(screen.queryByTitle('Put on Hold')).toBeNull();
    expect(screen.queryByTitle('Run QA Inspection Gate')).toBeNull();
    expect(screen.queryByTitle('Dispatch to Logistics Delivery')).toBeNull();
  });

  it('asks for a reason and stores holdFromStatus when a job is put on hold', async () => {
    const { setProjects } = renderJobs([job('Ongoing')]);
    fireEvent.click(screen.getByTitle('Put on Hold'));
    fireEvent.click(await screen.findByRole('button', { name: /Confirm Hold/i }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/reason/i));
    expect(updateDocument).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(/why is this job on hold/i), { target: { value: 'Waiting for canvas' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm Hold/i }));
    await waitFor(() => expect(updateDocument).toHaveBeenCalledTimes(1));
    expect(updateDocument.mock.calls[0][2]).toMatchObject({ status: 'On Hold', holdFromStatus: 'Ongoing', holdReason: 'Waiting for canvas' });
    expect(setProjects.mock.calls[0][0][0]).toMatchObject({ status: 'On Hold', holdFromStatus: 'Ongoing' });
    expect(logActivity).toHaveBeenCalledWith('admin@example.com', 'Admin', 'JOB_HELD', 'Fabrication', expect.stringContaining('PTF-3001'));
  });

  it('resumes an On Hold job into the stage it came from', async () => {
    const { setProjects } = renderJobs([job('On Hold', { holdFromStatus: 'Revision', holdReason: 'Waiting for canvas' })]);
    expect(screen.getByText(/Waiting for canvas/)).toBeInTheDocument();
    expect(screen.queryByTitle('Advance Stage')).toBeNull();
    fireEvent.click(screen.getByTitle('Resume job'));
    await waitFor(() => expect(updateDocument).toHaveBeenCalledTimes(1));
    expect(updateDocument.mock.calls[0][2]).toMatchObject({ status: 'Revision', holdFromStatus: null, holdReason: null });
    expect(setProjects.mock.calls[0][0][0]).toMatchObject({ status: 'Revision' });
  });

  it('resumes to Pending when the previous stage was not recorded', async () => {
    renderJobs([job('On Hold')]);
    fireEvent.click(screen.getByTitle('Resume job'));
    await waitFor(() => expect(updateDocument).toHaveBeenCalledTimes(1));
    expect(updateDocument.mock.calls[0][2]).toMatchObject({ status: 'Pending' });
  });

  it('offers Archive for Completed and Cancelled jobs but not for an Ongoing one', () => {
    const ongoing = renderFabricationWith('Ongoing');
    expect(screen.queryByTitle('Archive job')).toBeNull();
    ongoing.unmount();
    const completed = renderFabricationWith('Completed');
    expect(screen.getByTitle('Archive job')).toBeInTheDocument();
    completed.unmount();
    renderFabricationWith('Cancelled');
    expect(screen.getByTitle('Archive job')).toBeInTheDocument();
  });

  it('archives a Completed job, keeping its status', async () => {
    const { setProjects } = renderJobs([job('Completed')]);
    fireEvent.click(screen.getByTitle('Archive job'));
    await waitFor(() => expect(updateDocument).toHaveBeenCalledTimes(1));
    expect(updateDocument.mock.calls[0][2]).toEqual({ archived: true });
    expect(setProjects.mock.calls[0][0][0]).toMatchObject({ status: 'Completed', archived: true });
  });

  it('hides archived jobs until Show archived is ticked, and can unarchive them', async () => {
    renderJobs([job('Completed', { archived: true })]);
    expect(screen.queryByRole('button', { name: /Inspect Gallery Canvas/ })).toBeNull();
    fireEvent.click(screen.getByLabelText(/Show archived/i));
    expect(screen.getByRole('button', { name: /Inspect Gallery Canvas/ })).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Unarchive job'));
    await waitFor(() => expect(updateDocument).toHaveBeenCalledTimes(1));
    expect(updateDocument.mock.calls[0][2]).toMatchObject({ archived: false });
  });
});
