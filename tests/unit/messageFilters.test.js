import { describe, it, expect } from 'vitest';
import { getIncomingMessages, isReadByRecipient } from '@/features/messaging/messageFilters';

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
