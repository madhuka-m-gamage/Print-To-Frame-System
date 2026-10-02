import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeLead, makeDeal, makeInvoice } from '../helpers/factories';

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
vi.mock('@/features/admin/adminUsers', () => ({ deleteUserAccount: vi.fn(async () => {}) }));
vi.mock('@/services/mailer', () => ({ sendTemplatedEmail: vi.fn(async () => {}) }));

const { default: Customers } = await import('@/features/customers/Customers');
const sync = await import('@/services/firestoreSync');
const { toast } = await import('@/shared/utils/toast');
const { deleteUserAccount } = await import('@/features/admin/adminUsers');

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

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

const renderWith = (props = {}) => renderWithProviders(
  <Customers customers={[]} setCustomers={vi.fn()} users={[]} setUsers={vi.fn()} currentUser={admin} {...props} />,
  { role: 'Admin' }
);

const nimal = { nic: '901234567V', name: 'Nimal Fernando', phone: '0771234567', email: 'nimal@example.com', type: 'Individual', orders: 2, dateJoined: '2026-01-01' };
const other = { nic: '851111111V', name: 'Sunil Silva', phone: '0712222222', email: 'sunil@example.com', type: 'Individual', orders: 1, dateJoined: '2026-01-01' };

const selectCustomer = (name) => fireEvent.click(screen.getByText(name));

describe('Customers billing records (TST-3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists the Advance and Final invoices raised on the customer's lead lineage, with their amounts, and no one else's", () => {
    const lead = makeLead({ id: 'L-1', name: 'N. Fernando', email: 'nimal@example.com', phone: '+94771234567' });
    const deal = makeDeal({ lead, id: 'D-1' });
    const advance = makeInvoice({ from: lead, type: 'Advance', id: 'INV-ADV-0001', amount: 75000, status: 'Paid', customerName: 'N. Fernando' });
    const final = makeInvoice({ from: deal, type: 'Final', id: 'INV-FIN-0001', amount: 25000, status: 'Unpaid', customerName: 'N. Fernando' });
    const theirs = makeInvoice({ id: 'INV-ADV-0002', leadId: 'L-OTHER', amount: 999999, customerName: 'Sunil Silva' });
    renderWith({ customers: [nimal, other], dataStore: { leads: [lead, deal], invoices: [advance, final, theirs], projects: [] } });

    selectCustomer('Nimal Fernando');
    const panel = screen.getByText('Financial Invoices & Settlements').closest('div.md\\:col-span-2');
    expect(within(panel).getByText('2 invoices')).toBeTruthy();
    expect(within(panel).getByText('INV-ADV-0001')).toBeTruthy();
    expect(within(panel).getByText('LKR 75,000')).toBeTruthy();
    expect(within(panel).getByText('INV-FIN-0001')).toBeTruthy();
    expect(within(panel).getByText('LKR 25,000')).toBeTruthy();
    expect(within(panel).queryByText('INV-ADV-0002')).toBeNull();
  });

  it("matches an invoice by the customer's NIC or by the exact customer name", () => {
    const byNic = makeInvoice({ id: 'INV-ADV-0003', leadId: 'L-NONE', clientNIC: '901234567V', customerName: 'Someone Else', amount: 1000 });
    const byName = makeInvoice({ id: 'INV-ADV-0004', leadId: 'L-NONE', customerName: 'nimal fernando', amount: 2000 });
    const unrelated = makeInvoice({ id: 'INV-ADV-0005', leadId: 'L-NONE', customerName: 'Nimal Fernandez', amount: 3000 });
    renderWith({ customers: [nimal], dataStore: { leads: [], invoices: [byNic, byName, unrelated], projects: [] } });
    selectCustomer('Nimal Fernando');
    expect(screen.getByText('2 invoices')).toBeTruthy();
    expect(screen.queryByText('INV-ADV-0005')).toBeNull();
  });

  it('shows the empty state when the customer has no invoices', () => {
    renderWith({ customers: [nimal], dataStore: { leads: [], invoices: [], projects: [] } });
    selectCustomer('Nimal Fernando');
    expect(screen.getByText('No invoices generated for this client yet.')).toBeTruthy();
  });
});

describe('Customers register and delete (TST-3)', () => {
  beforeEach(() => vi.clearAllMocks());

  const openRegister = () => fireEvent.click(screen.getByRole('button', { name: /Register Client/ }));

  it('saves a new client with one order under its NIC, and refuses a duplicate NIC', async () => {
    renderWith({ customers: [nimal] });
    openRegister();
    fireEvent.change(screen.getByPlaceholderText('e.g. 199012345678 or PV123456'), { target: { value: '901234567V' } });
    fireEvent.change(screen.getByPlaceholderText('Client Name'), { target: { value: 'Duplicate Person' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    expect(toast.error).toHaveBeenCalledWith('Customer NIC/ID already exists.');
    expect(sync.addDocument).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('e.g. 199012345678 or PV123456'), { target: { value: '951111111V' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    await waitFor(() => expect(sync.addDocument).toHaveBeenCalledWith('customers', expect.objectContaining({ nic: '951111111V', name: 'Duplicate Person', orders: 1 }), '951111111V'));
  });

  it('links an approved Business Client to their login: the handed-off form saves the userId (FEA-15)', async () => {
    renderWithProviders(
      <Customers customers={[]} setCustomers={vi.fn()} users={[]} setUsers={vi.fn()} currentUser={{ role: 'Admin', name: 'Admin', identifier: 'admin@example.com' }}
        prefillClient={{ name: 'Acme Contact', email: 'acme@example.com', businessName: 'Acme Ltd', userId: 'uid-acme' }} onClientPrefillConsumed={vi.fn()} />,
      { role: 'Admin' }
    );
    fireEvent.change(await screen.findByPlaceholderText('e.g. 199012345678 or PV123456'), { target: { value: 'PV777777' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    await waitFor(() => expect(sync.addDocument).toHaveBeenCalledWith('customers', expect.objectContaining({ nic: 'PV777777', email: 'acme@example.com', userId: 'uid-acme' }), 'PV777777'));
  });

  it('a manual registration carries no userId', async () => {
    renderWith({ customers: [] });
    openRegister();
    fireEvent.change(screen.getByPlaceholderText('e.g. 199012345678 or PV123456'), { target: { value: '951111111V' } });
    fireEvent.change(screen.getByPlaceholderText('Client Name'), { target: { value: 'Walk In' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    await waitFor(() => expect(sync.addDocument).toHaveBeenCalled());
    expect(sync.addDocument.mock.calls[0][1]).not.toHaveProperty('userId');
  });

  it('deleting a Business Client removes the customer, its users document and its login', async () => {
    const biz = { nic: 'PV123456', name: 'Acme Contact', email: 'Acme@Example.com', type: 'Business', businessName: 'Acme Ltd', orders: 1 };
    const users = [{ identifier: 'acme@example.com', role: 'Business Client' }];
    renderWith({ customers: [biz], users });
    selectCustomer('Acme Ltd');
    fireEvent.click(screen.getByTitle('Delete customer profile'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Permanently' }));
    await waitFor(() => expect(deleteUserAccount).toHaveBeenCalledWith('acme@example.com'));
    expect(sync.deleteDocument).toHaveBeenCalledWith('customers', 'PV123456');
    expect(sync.deleteDocument).toHaveBeenCalledWith('users', 'acme@example.com');
  });

  it('deleting an Individual with no login removes only the customer document', async () => {
    renderWith({ customers: [nimal] });
    selectCustomer('Nimal Fernando');
    fireEvent.click(screen.getByTitle('Delete customer profile'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Permanently' }));
    await waitFor(() => expect(sync.deleteDocument).toHaveBeenCalledWith('customers', '901234567V'));
    expect(sync.deleteDocument).toHaveBeenCalledTimes(1);
    expect(deleteUserAccount).not.toHaveBeenCalled();
  });
});
