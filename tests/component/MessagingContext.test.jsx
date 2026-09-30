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
}));

vi.mock('@/features/messaging/audioAlert', () => ({ playMessageChime: vi.fn() }));

const { MessagingProvider, useMessaging } = await import('@/features/messaging/MessagingContext');
const { where } = await import('firebase/firestore');
const { triggerBrowserNotification } = await import('@/App');
const { playMessageChime } = await import('@/features/messaging/audioAlert');

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
