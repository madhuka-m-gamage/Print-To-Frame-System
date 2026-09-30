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

const { MessagingProvider, useMessaging } = await import('@/features/messaging/MessagingContext');
const { where } = await import('firebase/firestore');

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
