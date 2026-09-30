import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const ctx = {};
vi.mock('@/features/messaging/MessagingContext', () => ({
  useMessaging: () => ctx,
  getChannelId: (a, b) => [a, b].map((x) => String(x).toLowerCase()).sort().join('_'),
}));

const { default: MiniChatDrawer } = await import('@/features/messaging/MiniChatDrawer');
const { toast } = await import('@/shared/utils/toast');

const me = { identifier: 'bob@example.com', name: 'Bob', role: 'Sales' };
const alice = { identifier: 'alice@example.com', name: 'Alice', role: 'Operations' };

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(ctx, {
    isMiniChatOpen: true,
    miniChatContact: alice,
    openMiniChat: vi.fn(),
    toggleMiniChat: vi.fn(),
    closeMiniChat: vi.fn(),
    clearActiveContact: vi.fn(),
    messages: [],
    sendDirectMessage: vi.fn(async () => true),
    markChatAsRead: vi.fn(),
    resolveUserProfile: (u) => u,
    recentConversations: [],
    totalUnreadCount: 0,
  });
});

const type = (text) => fireEvent.change(screen.getByPlaceholderText('Type message...'), { target: { value: text } });
const send = () => fireEvent.submit(screen.getByPlaceholderText('Type message...').closest('form'));

describe('MiniChatDrawer send (D-MSG-07)', () => {
  it('restores the typed text and shows an error toast when the send fails', async () => {
    ctx.sendDirectMessage = vi.fn(async () => { throw new Error('offline'); });
    render(<MiniChatDrawer currentUser={me} />);
    type('Frame is ready');
    send();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/not sent/i)));
    expect(screen.getByPlaceholderText('Type message...')).toHaveValue('Frame is ready');
  });

  it('clears the input when the send succeeds', async () => {
    render(<MiniChatDrawer currentUser={me} />);
    type('Frame is ready');
    send();
    await waitFor(() => expect(ctx.sendDirectMessage).toHaveBeenCalledWith({ toId: 'alice@example.com', text: 'Frame is ready' }));
    expect(screen.getByPlaceholderText('Type message...')).toHaveValue('');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
