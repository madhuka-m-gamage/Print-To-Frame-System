import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';

const ctx = {};
const deleteDocument = vi.fn(async () => {});
vi.mock('@/services/firestoreSync', () => ({ deleteDocument: (...a) => deleteDocument(...a), COLLECTIONS: { NOTIFICATIONS: 'notifications' } }));
vi.mock('@/features/messaging/MessagingContext', () => ({ useMessaging: () => ctx }));

const { default: NotificationsView } = await import('@/features/dashboard/NotificationsView');

const me = { identifier: 'bob@example.com', name: 'Bob', role: 'Sales' };
const alice = { identifier: 'alice@example.com', name: 'Alice', role: 'Operations' };

describe('NotificationsView message feed (D-MSG-12)', () => {
  it('lists messages from others but not the ones the user sent', () => {
    Object.assign(ctx, {
      messages: [
        { _firestoreId: 'm1', fromId: 'alice@example.com', senderName: 'Alice', text: 'Frame is ready', timestamp: 1 },
        { _firestoreId: 'm2', fromId: 'Bob@Example.com', senderName: 'Bob', text: 'On my way', timestamp: 2 },
      ],
      openMiniChat: vi.fn(),
      markAllAsRead: vi.fn(),
      resolveUserProfile: (u) => (u.identifier === alice.identifier ? { ...alice, ...u } : u),
    });
    renderWithProviders(<NotificationsView notifications={[]} setNotifications={vi.fn()} users={[me, alice]} currentUser={me} />);
    expect(screen.getByText('Message from Alice')).toBeInTheDocument();
    expect(screen.queryByText('Message from Bob')).not.toBeInTheDocument();
    expect(screen.queryByText('On my way')).not.toBeInTheDocument();
  });
});

describe('NotificationsView persisted notifications (FEA-2)', () => {
  it('shows the signed-in user own notifications and hides ones addressed to someone else', () => {
    Object.assign(ctx, { messages: [], openMiniChat: vi.fn(), markAllAsRead: vi.fn(), resolveUserProfile: (u) => u });
    const notifications = [
      { id: 'a', title: 'Mine', message: 'for bob', type: 'commission', recipientEmail: 'Bob@Example.com', date: '2026-10-03T00:00:00.000Z' },
      { id: 'b', title: 'Theirs', message: 'for alice', type: 'commission', recipientEmail: 'alice@example.com', date: '2026-10-03T00:00:00.000Z' },
      { id: 'c', title: 'Local toast', message: 'no recipient', type: 'info', date: '2026-10-03T00:00:00.000Z' },
    ];
    renderWithProviders(<NotificationsView notifications={notifications} setNotifications={vi.fn()} users={[me, alice]} currentUser={me} />);
    expect(screen.getByText('Mine')).toBeInTheDocument();
    expect(screen.getByText('Local toast')).toBeInTheDocument();
    expect(screen.queryByText('Theirs')).not.toBeInTheDocument();
  });
});

describe('NotificationsView delete (FEA-18)', () => {
  beforeEach(() => {
    deleteDocument.mockClear();
    Object.assign(ctx, { messages: [], openMiniChat: vi.fn(), markAllAsRead: vi.fn(), resolveUserProfile: (u) => u });
  });

  it('deletes a persisted notification in Firestore and removes it locally', async () => {
    const setNotifications = vi.fn();
    const notifications = [{ id: 'a', _firestoreId: 'a', title: 'Mine', message: 'x', type: 'commission', recipientEmail: 'bob@example.com', date: '2026-10-03T00:00:00.000Z' }];
    renderWithProviders(<NotificationsView notifications={notifications} setNotifications={setNotifications} users={[me]} currentUser={me} />);
    fireEvent.click(screen.getByTitle('Dismiss Alert'));
    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith('notifications', 'a'));
    expect(setNotifications).toHaveBeenCalled();
  });

  it('drops messages the user has already read, so Mark Messages Read clears them (FEA-7)', () => {
    Object.assign(ctx, {
      messages: [
        { _firestoreId: 'm1', fromId: 'alice@example.com', senderName: 'Alice', text: 'Old news', timestamp: 1, readBy: ['bob@example.com'] },
        { _firestoreId: 'm2', fromId: 'alice@example.com', senderName: 'Alice', text: 'Fresh news', timestamp: 2, readBy: [] },
      ],
    });
    renderWithProviders(<NotificationsView notifications={[]} setNotifications={vi.fn()} users={[me, alice]} currentUser={me} />);
    expect(screen.getByText('Fresh news')).toBeInTheDocument();
    expect(screen.queryByText('Old news')).not.toBeInTheDocument();
  });

  it('shows the commission badge and its own icon (FEA-7)', () => {
    const notifications = [
      { id: 'a', title: 'Commission Eligible', message: 'paid', type: 'commission', recipientEmail: 'bob@example.com', date: '2026-10-03T00:00:00.000Z' },
      { id: 'b', title: 'Plain', message: 'sys', type: 'system', date: '2026-10-03T00:00:00.000Z' },
    ];
    const { container } = renderWithProviders(<NotificationsView notifications={notifications} setNotifications={vi.fn()} users={[me]} currentUser={me} />);
    expect(screen.getByText('COMMISSION')).toBeInTheDocument();
    const types = [...container.querySelectorAll('[data-icon-type]')].map((i) => i.getAttribute('data-icon-type')).sort();
    expect(types).toEqual(['commission', 'system']);
  });

  it('removes a session-only entry without touching Firestore', () => {
    const setNotifications = vi.fn();
    const notifications = [{ id: 'l1', title: 'Local toast', message: 'x', type: 'info', date: '2026-10-03T00:00:00.000Z' }];
    renderWithProviders(<NotificationsView notifications={notifications} setNotifications={setNotifications} users={[me]} currentUser={me} />);
    fireEvent.click(screen.getByTitle('Dismiss Alert'));
    expect(deleteDocument).not.toHaveBeenCalled();
    expect(setNotifications).toHaveBeenCalled();
  });
});
