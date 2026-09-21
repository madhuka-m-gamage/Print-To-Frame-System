import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToCsv } from '@/shared/utils/csvExport';

let captured;
let clicked;

beforeEach(() => {
  captured = null;
  clicked = null;
  globalThis.Blob = class { constructor(parts, opts) { captured = { text: parts.join(''), type: opts?.type }; } };
  globalThis.URL = { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() };
  const link = { setAttribute: vi.fn((k, v) => { link[k] = v; }), click: vi.fn(() => { clicked = { ...link }; }) };
  globalThis.document = {
    createElement: vi.fn(() => link),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
  };
});

afterEach(() => {
  delete globalThis.Blob;
  delete globalThis.URL;
  delete globalThis.document;
});

const cols = [{ key: 'name', label: 'Name' }, { key: 'note', label: 'Note' }];

describe('exportToCsv', () => {
  it('throws for empty or missing data so the caller can show a message', () => {
    expect(() => exportToCsv([], cols)).toThrow(/No data/);
    expect(() => exportToCsv(undefined, cols)).toThrow(/No data/);
  });

  it('writes a BOM, a quoted header row and CRLF-separated quoted rows', () => {
    exportToCsv([{ name: 'Kasun', note: 'a' }, { name: 'Nimal', note: 'b' }], cols, 'People');
    expect(captured.text).toBe('﻿"Name","Note"\r\n"Kasun","a"\r\n"Nimal","b"');
    expect(captured.type).toContain('text/csv');
  });

  it('escapes double quotes and keeps commas and newlines inside one quoted cell', () => {
    exportToCsv([{ name: 'He said "hi"', note: 'a,b\nc' }], cols);
    expect(captured.text).toContain('"He said ""hi""","a,b\nc"');
  });

  it('writes null and undefined values as empty quoted cells and stringifies numbers', () => {
    exportToCsv([{ name: null, note: 5 }, { name: undefined, note: 0 }], cols);
    expect(captured.text).toContain('"","5"');
    expect(captured.text).toContain('"","0"');
  });

  it('prefers a column accessor over the key', () => {
    exportToCsv([{ a: 1, b: 2 }], [{ key: 'a', label: 'Sum', accessor: (r) => r.a + r.b }]);
    expect(captured.text).toContain('"3"');
  });

  it('downloads a file named with the base name and today\'s date', () => {
    exportToCsv([{ name: 'x', note: 'y' }], cols, 'Receipts');
    expect(clicked.download).toMatch(/^Receipts_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
