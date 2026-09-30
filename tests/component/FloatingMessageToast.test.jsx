import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const ctx = {};
vi.mock('@/features/messaging/MessagingContext', () => ({ useMessaging: () => ctx }));

const { default: FloatingMessageToast } = await import('@/features/messaging/FloatingMessageToast');
const { toast } = await import('@/shared/utils/toast');

const alice = { identifier: 'alice@example.com', name: 'Alice', role: 'Operations' };
const incoming = {
  _firestoreId: 'msg_1_abcde', fromId: 'alice@example.com', toId: 'bob@example.com',
  senderName: 'Alice', text: 'Frame is ready', timestamp: 1, sender: alice,
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(ctx, {
    activeToastMessage: incoming,
    dismissToast: vi.fn(),
    openMiniChat: vi.fn(),
    sendDirectMessage: vi.fn(async () => true),
    resolveUserProfile: (u) => u,
  });
});

const quickReply = (text) => {
  render(<FloatingMessageToast />);
  fireEvent.click(screen.getByRole('button', { name: /Quick Reply/ }));
  fireEvent.change(screen.getByPlaceholderText('Reply to Alice...'), { target: { value: text } });
  fireEvent.submit(screen.getByPlaceholderText('Reply to Alice...').closest('form'));
};

describe('FloatingMessageToast quick reply (D-MSG-07)', () => {
  it('keeps the reply text and shows an error toast when the send fails', async () => {
    ctx.sendDirectMessage = vi.fn(async () => { throw new Error('offline'); });
    quickReply('Thanks');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/not sent/i)));
    expect(screen.getByPlaceholderText('Reply to Alice...')).toHaveValue('Thanks');
    expect(ctx.dismissToast).not.toHaveBeenCalled();
  });
});
