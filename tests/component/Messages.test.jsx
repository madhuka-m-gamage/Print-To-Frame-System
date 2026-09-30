import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const typing = { emit: null };

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  onSnapshot: vi.fn((_ref, onNext) => { typing.emit = onNext; return () => {}; }),
}));
vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { TYPING_INDICATORS: 'typing_indicators', MESSAGES: 'messages' },
  setDocument: vi.fn(async () => {}),
}));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/shared/components/EmailTemplateModal', () => ({ default: () => null }));

const ctx = {};
vi.mock('@/features/messaging/MessagingContext', () => ({
  useMessaging: () => ctx,
  getChannelId: (a, b) => [a, b].map((x) => String(x).toLowerCase()).sort().join('_'),
}));

const { default: Messages } = await import('@/features/messaging/Messages');
const { setDocument } = await import('@/services/firestoreSync');

const me = { identifier: 'bob@example.com', name: 'Bob', role: 'Sales' };
const alice = { identifier: 'alice@example.com', name: 'Alice', role: 'Operations' };
const users = [me, alice];

const typingSnap = (docs) => ({ forEach: (fn) => docs.forEach((d) => fn({ data: () => d })) });
const input = () => screen.getByRole('textbox', { name: 'Message Alice' });

let now;
beforeEach(() => {
  vi.clearAllMocks();
  now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  Object.assign(ctx, {
    messages: [],
    unreadCounts: {},
    sendDirectMessage: vi.fn(async () => true),
    markChatAsRead: vi.fn(),
    setActiveChatContactId: vi.fn(),
  });
});
afterEach(() => vi.restoreAllMocks());

describe('Messages typing indicator (D-MSG-04)', () => {
  it('writes the typing indicator at most once per 800 ms while typing, and once when cleared', () => {
    render(<Messages users={users} currentUser={me} />);
    fireEvent.change(input(), { target: { value: 'h' } });
    now += 100;
    fireEvent.change(input(), { target: { value: 'he' } });
    now += 100;
    fireEvent.change(input(), { target: { value: 'hel' } });
    expect(setDocument).toHaveBeenCalledTimes(1);
    expect(setDocument.mock.calls[0][2]).toMatchObject({ isTyping: true });

    now += 800;
    fireEvent.change(input(), { target: { value: 'hell' } });
    expect(setDocument).toHaveBeenCalledTimes(2);

    fireEvent.change(input(), { target: { value: '' } });
    fireEvent.change(input(), { target: { value: '' } });
    expect(setDocument).toHaveBeenCalledTimes(3);
    expect(setDocument.mock.calls[2][2]).toMatchObject({ isTyping: false });
  });

  it('shows "is typing" only when the contact is typing in this conversation', () => {
    render(<Messages users={users} currentUser={me} />);
    act(() => typing.emit(typingSnap([
      { fromId: 'alice@example.com', channelId: 'alice@example.com_carol@example.com', isTyping: true, timestamp: now },
    ])));
    expect(screen.queryByText('Alice is typing...')).not.toBeInTheDocument();

    act(() => typing.emit(typingSnap([
      { fromId: 'alice@example.com', channelId: 'alice@example.com_bob@example.com', isTyping: true, timestamp: now },
    ])));
    expect(screen.getByText('Alice is typing...')).toBeInTheDocument();
  });
});

describe('Messages delivery ticks (D-MSG-08)', () => {
  it('shows one tick for a sent message and two once Alice has read it; none on her messages', () => {
    const base = { channelId: 'alice@example.com_bob@example.com', participants: ['alice@example.com', 'bob@example.com'], timestamp: 1 };
    ctx.messages = [
      { ...base, _firestoreId: 'm1', fromId: 'bob@example.com', toId: 'alice@example.com', text: 'read', readBy: ['bob@example.com', 'alice@example.com'] },
      { ...base, _firestoreId: 'm2', fromId: 'bob@example.com', toId: 'alice@example.com', text: 'unread', readBy: ['bob@example.com'] },
      { ...base, _firestoreId: 'm3', fromId: 'alice@example.com', toId: 'bob@example.com', text: 'hers', readBy: ['alice@example.com', 'bob@example.com'] },
    ];
    render(<Messages users={users} currentUser={me} />);
    expect(screen.getAllByRole('img', { name: 'Read' })).toHaveLength(1);
    expect(screen.getAllByRole('img', { name: 'Sent' })).toHaveLength(1);
  });
});

describe('Messages quoted reply (D-MSG-09)', () => {
  const hers = {
    _firestoreId: 'msg_1_ab', channelId: 'alice@example.com_bob@example.com', participants: ['alice@example.com', 'bob@example.com'],
    fromId: 'alice@example.com', toId: 'bob@example.com', senderName: 'Alice', text: 'Is the frame ready?', timestamp: 1, readBy: [],
  };

  it('replies to a message: Reply sets the quote, Send passes the message, the quote clears', async () => {
    ctx.messages = [hers];
    render(<Messages users={users} currentUser={me} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reply to message' }));
    expect(screen.getByText(/Replying to/).textContent).toMatch(/Replying to Alice: Is the frame ready\?/);

    fireEvent.change(input(), { target: { value: 'Yes' } });
    await act(async () => { fireEvent.submit(input().closest('form')); });
    expect(ctx.sendDirectMessage).toHaveBeenCalledWith({ toId: 'alice@example.com', text: 'Yes', replyTo: hers });
    expect(screen.queryByRole('button', { name: 'Cancel reply' })).not.toBeInTheDocument();
  });

  it('can cancel a reply before sending', () => {
    ctx.messages = [hers];
    render(<Messages users={users} currentUser={me} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reply to message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel reply' }));
    expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument();
  });

  it('shows the quoted sender, falling back to the sender id for older replies without a name', () => {
    ctx.messages = [
      { ...hers, _firestoreId: 'm2', fromId: 'bob@example.com', toId: 'alice@example.com', text: 'Yes', replyTo: { id: 'msg_1_ab', text: 'Is the frame ready?', fromId: 'alice@example.com', senderName: 'Alice' } },
      { ...hers, _firestoreId: 'm3', fromId: 'bob@example.com', toId: 'alice@example.com', text: 'Again', replyTo: { id: 'msg_1_ab', text: 'Old quote', fromId: 'alice@example.com' } },
    ];
    render(<Messages users={users} currentUser={me} />);
    expect(screen.getByText('Alice', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('alice@example.com', { selector: 'strong' })).toBeInTheDocument();
  });
});

describe('Messages send failure (D-MSG-07)', () => {
  it('puts the text back in the input and shows an error toast', async () => {
    const { toast } = await import('@/shared/utils/toast');
    ctx.sendDirectMessage = vi.fn(async () => { throw new Error('offline'); });
    render(<Messages users={users} currentUser={me} />);
    fireEvent.change(input(), { target: { value: 'Frame is ready' } });
    await act(async () => { fireEvent.submit(input().closest('form')); });
    expect(toast.error).toHaveBeenCalledWith('Message not sent: offline');
    expect(input()).toHaveValue('Frame is ready');
  });
});

describe('Messages history paging (D-MSG-05)', () => {
  it('offers "Load older messages" in the open conversation and asks the context for them', () => {
    ctx.loadOlderMessages = vi.fn();
    ctx.historySince = now - 30 * 24 * 60 * 60 * 1000;
    render(<Messages users={users} currentUser={me} />);
    fireEvent.click(screen.getByRole('button', { name: /Load older messages/ }));
    expect(ctx.loadOlderMessages).toHaveBeenCalledTimes(1);
  });
});
