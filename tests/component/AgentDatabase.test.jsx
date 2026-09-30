import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { AUDIT_LOG: 'auditLog', USERS: 'users', PENDING_USERS: 'pendingUsers', PARTNER_APPLICATIONS: 'partner_applications' },
  subscribeToCollection: vi.fn(() => () => {}),
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
}));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('@/services/mailer', () => ({ sendTemplatedEmail: vi.fn(async () => {}) }));
vi.mock('@/features/admin/adminUsers', () => ({
  createUserAccount: vi.fn(async () => {}),
  deleteUserAccount: vi.fn(async () => {}),
  resetUserPassword: vi.fn(async () => {}),
}));

const { default: AgentDatabase } = await import('@/features/admin/AgentDatabase');
const { sendTemplatedEmail } = await import('@/services/mailer');

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

beforeEach(() => vi.clearAllMocks());

describe('AgentDatabase decline', () => {
  // api/send-email.js only mails an address it finds in a record (BACKLOG SEC-1), so the
  // decline email must go out while the pendingUsers document still exists.
  it('sends registration_declined before the pending registration is deleted', async () => {
    const calls = [];
    sendTemplatedEmail.mockImplementation(async (to, templateId) => { calls.push(`email:${templateId}:${to}`); });
    const onReject = vi.fn(async (identifier) => { calls.push(`delete:${identifier}`); });
    const pending = { identifier: 'applicant@example.com', name: 'Nimal Perera', role: 'Sales' };

    renderWithProviders(
      <AgentDatabase users={[]} setUsers={vi.fn()} pendingUsers={[pending]} setPendingUsers={vi.fn()} currentUser={admin} onReject={onReject} />,
      { role: 'Admin' }
    );
    fireEvent.click(screen.getByTitle('Decline'));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls).toEqual(['email:registration_declined:applicant@example.com', 'delete:applicant@example.com']);
  });
});

describe('AgentDatabase staff approval email (employees D6)', () => {
  const renderPending = (pending, onApprove) => renderWithProviders(
    <AgentDatabase users={[]} setUsers={vi.fn()} pendingUsers={[pending]} setPendingUsers={vi.fn()} currentUser={admin} onApprove={onApprove} />,
    { role: 'Admin' }
  );

  // api/send-email.js only mails an address it finds in a record (SEC-1): onApprove writes users/{email} first.
  it('sends employee_approved to a staff applicant after the users document is written', async () => {
    const calls = [];
    sendTemplatedEmail.mockImplementation(async (to, templateId) => { calls.push(`email:${templateId}:${to}`); });
    const onApprove = vi.fn(async (regData) => { calls.push(`approve:${regData.identifier}`); });
    renderPending({ identifier: 'applicant@example.com', name: 'Nimal Perera', role: 'Sales' }, onApprove);

    fireEvent.click(screen.getByTitle(/Quick Approve/));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls).toEqual(['approve:applicant@example.com', 'email:employee_approved:applicant@example.com']);
    expect(sendTemplatedEmail.mock.calls[0][2]).toEqual(expect.objectContaining({
      recipientName: 'Nimal Perera', assignedRole: 'Sales', loginEmail: 'applicant@example.com',
    }));
  });

  it('sends nothing here for a Partner or Business Client, whose email follows the handed-off form', async () => {
    const onApprove = vi.fn(async () => {});
    renderPending({ identifier: 'studio@example.com', name: 'Studio', role: 'Partner' }, onApprove);

    fireEvent.click(screen.getByTitle(/Quick Approve/));

    await waitFor(() => expect(onApprove).toHaveBeenCalled());
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it('sends employee_invite with the set password when a partner application is approved into a staff role', async () => {
    const onApprove = vi.fn(async () => {});
    renderWithProviders(
      <AgentDatabase users={[]} setUsers={vi.fn()} pendingUsers={[]} setPendingUsers={vi.fn()} currentUser={admin} onApprove={onApprove}
        partnerApplications={[{ id: 'app-1', email: 'Studio@Example.com', contactPerson: 'Ruwan' }]} />,
      { role: 'Admin' }
    );

    fireEvent.click(screen.getByTitle('Review Full Dossier'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Operations' } });
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'secret12' } });
    fireEvent.click(screen.getByText('Approve as Operations'));

    await waitFor(() => expect(sendTemplatedEmail).toHaveBeenCalled());
    expect(sendTemplatedEmail).toHaveBeenCalledWith('studio@example.com', 'employee_invite', expect.objectContaining({
      assignedRole: 'Operations', tempPassword: 'secret12',
    }));
  });
});

const renderMembers = (users) => renderWithProviders(
  <AgentDatabase users={users} setUsers={vi.fn()} pendingUsers={[]} setPendingUsers={vi.fn()} currentUser={admin} />,
  { role: 'Admin' }
);

describe('AgentDatabase member status and email defaults (employees D8)', () => {
  it('shows the member status with StatusBadge: Active as success, Deactivated as danger', () => {
    const { container, unmount } = renderMembers([{ identifier: 'sales@example.com', name: 'Active Sales', role: 'Sales', status: 'Active' }]);
    expect(container.querySelector('.text-status-success-on')).toHaveTextContent('Active');
    unmount();

    const view = renderMembers([{ identifier: 'gone@example.com', name: 'Gone Sales', role: 'Sales', status: 'Deactivated' }]);
    expect(view.container.querySelector('.text-status-danger-on')).toHaveTextContent('Deactivated');
  });

  // The composer's own role default applies: a Customer gets quote_submission, not employee_invite.
  it('does not open the staff onboarding template for a retail Customer', async () => {
    renderMembers([{ identifier: 'customer@example.com', name: 'Retail Buyer', role: 'Customer', status: 'Active' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    expect(await screen.findByDisplayValue(/^Quotation for Steel Framing/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/Welcome to the Print To Frame Team/)).not.toBeInTheDocument();
  });

  it('still opens the staff onboarding template for a staff member', async () => {
    renderMembers([{ identifier: 'sales@example.com', name: 'Active Sales', role: 'Sales', status: 'Active' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    expect(await screen.findByDisplayValue(/Welcome to the Print To Frame Team/)).toBeInTheDocument();
  });
});
