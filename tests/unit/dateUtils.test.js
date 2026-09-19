import { describe, it, expect } from 'vitest';
import { toDateObj, formatDate, formatDateTime } from '../../src/utils/dateUtils';

describe('dateUtils', () => {
  it('handles null, undefined and empty strings', () => {
    expect(toDateObj(null)).toBeNull();
    expect(toDateObj(undefined)).toBeNull();
    expect(toDateObj('')).toBeNull();
    expect(formatDate(null)).toBe('—');
    expect(formatDateTime(undefined, 'N/A')).toBe('N/A');
  });

  it('handles native Date instances', () => {
    const d = new Date('2026-09-09T10:00:00Z');
    expect(toDateObj(d)?.toISOString()).toBe(d.toISOString());
  });

  it('handles ISO string timestamps', () => {
    const str = '2026-09-09T10:00:00.000Z';
    expect(toDateObj(str)?.toISOString()).toBe(str);
  });

  it('handles numeric epoch timestamps', () => {
    const epoch = 1788921600000;
    expect(toDateObj(epoch)?.getTime()).toBe(epoch);
    expect(toDateObj(String(epoch))?.getTime()).toBe(epoch);
  });

  it('handles Firestore Timestamp object with .toDate()', () => {
    const mockDate = new Date('2026-09-09T08:00:00Z');
    const mockFsTs = {
      toDate: () => mockDate
    };
    expect(toDateObj(mockFsTs)?.toISOString()).toBe(mockDate.toISOString());
  });

  it('handles Firestore raw { seconds, nanoseconds } object', () => {
    const seconds = 1788921600;
    const fsObj = { seconds, nanoseconds: 500000000 };
    const res = toDateObj(fsObj);
    expect(res?.getTime()).toBe(seconds * 1000 + 500);
  });

  it('formats dates consistently', () => {
    const d = new Date('2026-09-09T12:00:00Z');
    const formatted = formatDate(d);
    expect(formatted).toContain('2026');
    expect(formatted).toContain('Sep');
  });
});
