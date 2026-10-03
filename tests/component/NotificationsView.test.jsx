import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';

const ctx = {};
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
