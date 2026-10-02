import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const snap = { emit: null };

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'messagesRef'),
  query: vi.fn((...parts) => parts),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  documentId: vi.fn(() => '__name__'),
  onSnapshot: vi.fn((_q, onNext) => { snap.emit = onNext; return () => {}; }),
}));
vi.mock('@/App', () => ({ triggerBrowserNotification: vi.fn() }));
vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { MESSAGES: 'messages' },
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  batchWrite: vi.fn(async () => {}),
}));

vi.mock('@/features/messaging/audioAlert', () => ({ playMessageChime: vi.fn() }));

const { MessagingProvider, useMessaging } = await import('@/features/messaging/MessagingContext');
const { where } = await import('firebase/firestore');
const { triggerBrowserNotification } = await import('@/App');
const { playMessageChime } = await import('@/features/messaging/audioAlert');
const { addDocument, updateDocument, batchWrite } = await import('@/services/firestoreSync');

const snapshotOf = (msgs) => ({ forEach: (fn) => msgs.forEach((m) => fn({ id: m.id, data: () => m })) });
const incoming = (overrides = {}) => ({
  id: `msg_${now + 1}_abcde`, channelId: 'alice@example.com_bob@example.com',
  participants: ['alice@example.com', 'bob@example.com'], fromId: 'alice@example.com', toId: 'bob@example.com',
  senderName: 'Alice', text: 'Frame is ready', timestamp: now + 1, readBy: ['alice@example.com'], ...overrides,
});
let visibility = 'visible';
const receive = (msg) => {
  act(() => snap.emit(snapshotOf([])));
  act(() => snap.emit(snapshotOf([msg])));
};

const DAY = 24 * 60 * 60 * 1000;
const me = { identifier: 'bob@example.com', name: 'Bob', role: 'Sales' };
const alice = { identifier: 'alice@example.com', name: 'Alice', role: 'Operations' };

let api;
const Probe = () => { api = useMessaging(); return null; };
const renderProvider = (props = {}) => render(
  <MessagingProvider currentUser={me} users={[me, alice]} activeTab="dashboard" {...props}>
    <Probe />
  </MessagingProvider>
);

let now;
beforeEach(() => {
  vi.clearAllMocks();
  now = 100 * DAY;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

const idFloors = () => where.mock.calls.filter(([field]) => field === '__name__').map(([, op, value]) => `${op} ${value}`);

describe('MessagingProvider history window (D-MSG-05)', () => {
  it('listens only to the last 30 days of messages, by the timestamp in the message id', () => {
    renderProvider();
    expect(where).toHaveBeenCalledWith('participants', 'array-contains', 'bob@example.com');
    expect(idFloors().at(-1)).toBe(`>= msg_${70 * DAY}`);
  });

  it('widens the window by another 30 days on loadOlderMessages', () => {
    renderProvider();
    act(() => api.loadOlderMessages());
    expect(idFloors().at(-1)).toBe(`>= msg_${40 * DAY}`);
    expect(api.historySince).toBe(40 * DAY);
  });
});

describe('MessagingProvider optimistic sends (D-MSG-07)', () => {
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };

  it('shows the message as sending at once, and as sent when the write is acknowledged', async () => {
    const write = deferred();
    addDocument.mockReturnValueOnce(write.promise);
    renderProvider();
    let sent;
    act(() => { sent = api.sendDirectMessage({ toId: 'alice@example.com', text: 'On my way' }); });
    expect(api.messages).toEqual([expect.objectContaining({ text: 'On my way', status: 'sending' })]);

    await act(async () => { write.resolve(); await sent; });
    expect(api.messages).toEqual([]);
  });

  it('drops the optimistic copy and rethrows when the write fails, so the caller can restore the text', async () => {
    const write = deferred();
    addDocument.mockReturnValueOnce(write.promise);
    renderProvider();
    let sent;
    act(() => { sent = api.sendDirectMessage({ toId: 'alice@example.com', text: 'On my way' }); });
    await act(async () => {
      write.reject(new Error('offline'));
      await expect(sent).rejects.toThrow('offline');
    });
    expect(api.messages).toEqual([]);
  });

  it('marks the listener copy as sending until the write is acknowledged', async () => {
    const write = deferred();
    addDocument.mockReturnValueOnce(write.promise);
    renderProvider();
    let sent;
    act(() => { sent = api.sendDirectMessage({ toId: 'alice@example.com', text: 'On my way' }); });
    const [optimistic] = api.messages;
    act(() => snap.emit(snapshotOf([{ ...optimistic, id: optimistic._firestoreId, status: undefined }])));
    expect(api.messages).toHaveLength(1);
    expect(api.messages[0].status).toBe('sending');

    await act(async () => { write.resolve(); await sent; });
    expect(api.messages).toHaveLength(1);
    expect(api.messages[0].status).toBeUndefined();
  });
});

describe('MessagingProvider reply schema (D-MSG-09)', () => {
  it('stores replyTo as { id, text, fromId, senderName } whatever the caller passes', async () => {
    renderProvider();
    await act(async () => {
      await api.sendDirectMessage({ toId: 'alice@example.com', text: 'Thanks', replyTo: { ...incoming(), _firestoreId: 'msg_9_zz', sender: alice } });
    });
    expect(addDocument).toHaveBeenCalledWith('messages', expect.objectContaining({
      replyTo: { id: 'msg_9_zz', text: 'Frame is ready', fromId: 'alice@example.com', senderName: 'Alice' },
    }), expect.any(String));
  });
});

describe('MessagingProvider incoming alerts (D-MSG-06)', () => {
  beforeEach(() => {
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  });

  const viewAliceChat = () => {
    renderProvider({ activeTab: 'messages' });
    act(() => api.setActiveChatContactId('alice@example.com'));
  };

  it('stays quiet when the open, focused Messages tab is showing that chat', () => {
    viewAliceChat();
    receive(incoming());
    expect(triggerBrowserNotification).not.toHaveBeenCalled();
    expect(playMessageChime).not.toHaveBeenCalled();
    expect(api.activeToastMessage).toBeNull();
  });

  it('notifies and chimes when the chat is open but the browser tab is in the background', () => {
    visibility = 'hidden';
    viewAliceChat();
    receive(incoming());
    expect(triggerBrowserNotification).toHaveBeenCalledWith('Message from Alice', expect.objectContaining({ tag: 'chat-message' }));
    expect(playMessageChime).toHaveBeenCalledTimes(1);
  });

  it('notifies when the window has lost focus', () => {
    document.hasFocus.mockReturnValue(false);
    viewAliceChat();
    receive(incoming());
    expect(triggerBrowserNotification).toHaveBeenCalledTimes(1);
  });

  it('does not chime when the user turned audio alerts off in their profile', () => {
    renderProvider({ currentUser: { ...me, audioAlertsEnabled: false } });
    receive(incoming());
    expect(triggerBrowserNotification).toHaveBeenCalledTimes(1);
    expect(playMessageChime).not.toHaveBeenCalled();
  });
});

describe('MessagingProvider batched read receipts (FEA-12)', () => {
  const unreadFrom = (n, fromId = 'alice@example.com') => Array.from({ length: n }, (_, i) => incoming({
    id: `msg_${now + 1 + i}_${String(i).padStart(5, '0')}`,
    timestamp: now + 1 + i,
    fromId,
    readBy: i === 0 ? [fromId] : [fromId, 'carol@example.com'],
  }));
  const seed = (msgs) => {
    renderProvider();
    act(() => snap.emit(snapshotOf([])));
    act(() => snap.emit(snapshotOf(msgs)));
  };
  const written = () => batchWrite.mock.calls.flatMap(([ops]) => ops);

  it.each([[0, 0], [1, 1], [3, 1], [501, 2]])('markChatAsRead with %i unread sends %i batch call(s)', async (count, calls) => {
    const msgs = unreadFrom(count);
    seed(msgs);
    await act(async () => { await api.markChatAsRead('alice@example.com'); });
    expect(batchWrite).toHaveBeenCalledTimes(calls);
    batchWrite.mock.calls.forEach(([ops]) => expect(ops.length).toBeLessThanOrEqual(500));
    expect(updateDocument).not.toHaveBeenCalled();
    expect(written()).toEqual(msgs.map((m) => ({
      type: 'update', collection: 'messages', docId: m.id, data: { readBy: [...m.readBy, 'bob@example.com'] },
    })));
  });

  it.each([[0, 0], [1, 1], [3, 1], [501, 2]])('markAllAsRead with %i unread sends %i batch call(s)', async (count, calls) => {
    const msgs = unreadFrom(count);
    seed(msgs);
    await act(async () => { await api.markAllAsRead(); });
    expect(batchWrite).toHaveBeenCalledTimes(calls);
    batchWrite.mock.calls.forEach(([ops]) => expect(ops.length).toBeLessThanOrEqual(500));
    expect(updateDocument).not.toHaveBeenCalled();
    expect(written().map((o) => o.docId)).toEqual(msgs.map((m) => m.id));
    expect(written().every((o) => o.data.readBy.at(-1) === 'bob@example.com')).toBe(true);
  });

  it('skips messages that are already read or sent by me', async () => {
    const msgs = [
      incoming({ id: `msg_${now + 1}_aaaaa`, readBy: ['alice@example.com', 'bob@example.com'] }),
      incoming({ id: `msg_${now + 2}_bbbbb`, fromId: 'bob@example.com', toId: 'alice@example.com', readBy: ['bob@example.com'] }),
    ];
    seed(msgs);
    await act(async () => { await api.markAllAsRead(); });
    expect(batchWrite).not.toHaveBeenCalled();
  });
});
