import { describe, it, expect } from 'vitest';
import { getIncomingMessages, isReadByRecipient, buildReplyTo } from '@/features/messaging/messageFilters';

describe('buildReplyTo (D-MSG-09)', () => {
  it('stores one shape { id, text, fromId, senderName } from a listened message', () => {
    expect(buildReplyTo({ _firestoreId: 'msg_1_ab', id: 'x', text: 'Frame is ready', fromId: 'alice@example.com', senderName: 'Alice', readBy: [] }))
      .toEqual({ id: 'msg_1_ab', text: 'Frame is ready', fromId: 'alice@example.com', senderName: 'Alice' });
  });

  it('takes the name from a toast sender profile, then falls back to the sender id, never undefined', () => {
    expect(buildReplyTo({ id: 'm2', text: 'Hi', fromId: 'alice@example.com', sender: { name: 'Alice A' } }).senderName).toBe('Alice A');
    expect(buildReplyTo({ id: 'm3', fromId: 'alice@example.com' })).toEqual({ id: 'm3', text: '', fromId: 'alice@example.com', senderName: 'alice@example.com' });
  });

  it('is null when there is nothing to reply to', () => {
    expect(buildReplyTo(null)).toBeNull();
  });
});

describe('isReadByRecipient (D-MSG-08)', () => {
  it('is true only when the recipient is in readBy, ignoring case and whitespace', () => {
    expect(isReadByRecipient({ toId: 'Alice@Example.com', readBy: ['bob@example.com', ' alice@example.com'] })).toBe(true);
    expect(isReadByRecipient({ toId: 'alice@example.com', readBy: ['bob@example.com'] })).toBe(false);
  });

  it('is false for a message with no recipient or no readBy', () => {
    expect(isReadByRecipient({ readBy: ['bob@example.com'] })).toBe(false);
    expect(isReadByRecipient({ toId: 'alice@example.com' })).toBe(false);
    expect(isReadByRecipient(null)).toBe(false);
  });
});

describe('getIncomingMessages', () => {
  const msgs = [
    { id: 1, fromId: 'Me@Example.com', text: 'sent by me' },
    { id: 2, fromId: 'other@example.com', text: 'incoming' },
    { id: 3, fromId: ' me@example.com ', text: 'mine, padded' },
  ];

  it('drops messages the current user sent, ignoring case and whitespace', () => {
    expect(getIncomingMessages(msgs, 'me@example.com').map(m => m.id)).toEqual([2]);
  });

  it('keeps everything when the current user is unknown, and tolerates empty input', () => {
    expect(getIncomingMessages(msgs, '')).toHaveLength(3);
    expect(getIncomingMessages(null, 'me@example.com')).toEqual([]);
  });
});
