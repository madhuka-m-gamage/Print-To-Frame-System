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

const { generateInvoiceId } = await import('../../src/services/firestoreSync');
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
