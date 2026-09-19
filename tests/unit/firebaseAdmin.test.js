import { describe, it, expect } from 'vitest';
import { parseServiceAccountJson } from '../../api/_lib/firebaseAdmin.js';

const SAMPLE_ACCOUNT = {
  type: 'service_account',
  project_id: 'demo-print2frame-test',
  private_key: '-----BEGIN PRIVATE KEY-----\nFAKEKEY\n-----END PRIVATE KEY-----\n',
  client_email: 'test@demo-print2frame-test.iam.gserviceaccount.com',
};

describe('parseServiceAccountJson', () => {
  it('parses a raw JSON string', () => {
    const raw = JSON.stringify(SAMPLE_ACCOUNT);
    expect(parseServiceAccountJson(raw)).toEqual(SAMPLE_ACCOUNT);
  });

  it('parses a base64-encoded JSON string (the recommended format)', () => {
    const b64 = Buffer.from(JSON.stringify(SAMPLE_ACCOUNT), 'utf8').toString('base64');
    expect(parseServiceAccountJson(b64)).toEqual(SAMPLE_ACCOUNT);
  });

  it('tolerates surrounding whitespace/newlines from a copy-pasted env value', () => {
    const raw = `  ${JSON.stringify(SAMPLE_ACCOUNT)}  \n`;
    expect(parseServiceAccountJson(raw)).toEqual(SAMPLE_ACCOUNT);
  });

  it('throws a clear error when the variable is missing entirely', () => {
    expect(() => parseServiceAccountJson(undefined)).toThrow(/environment variable is missing/);
    expect(() => parseServiceAccountJson('')).toThrow(/environment variable is missing/);
  });

  it('throws a diagnostic error (not a cryptic JSON.parse failure) for a malformed value', () => {
    // This is the exact failure mode a double-JSON.stringify'd value produces:
    // wrapping already-valid JSON text in JSON.stringify() again yields a
    // string that starts with a literal `"` and embeds escaped `\"` — not
    // valid JSON on a single parse pass, and not valid base64 either.
    const doubleEncoded = JSON.stringify(JSON.stringify(SAMPLE_ACCOUNT));
    expect(() => parseServiceAccountJson(doubleEncoded)).toThrow(/could not be parsed as JSON/);
  });
});
