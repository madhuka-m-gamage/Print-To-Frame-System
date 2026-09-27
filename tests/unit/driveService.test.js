import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/firebase', () => ({ getScopedAccessToken: vi.fn(), googleApiConfig: { apiKey: 'k', projectNumber: '1' } }));
const { DRIVE_FILE_SCOPE, pickerDocsToAttachments } = await import('@/services/driveService');

describe('Google Picker attachments (DEC-8)', () => {
  it('uses the narrow drive.file scope, not drive.readonly', () => {
    expect(DRIVE_FILE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file');
  });

  it('keeps the attachment shape quotations already store', () => {
    const docs = [{ id: 'f1', name: 'Proof.pdf', mimeType: 'application/pdf', url: 'https://drive.google.com/file/d/f1/view', iconUrl: 'x' }];
    expect(pickerDocsToAttachments(docs)).toEqual([{ id: 'f1', name: 'Proof.pdf', mimeType: 'application/pdf', webViewLink: 'https://drive.google.com/file/d/f1/view' }]);
  });

  it('returns nothing when the picker was cancelled', () => {
    expect(pickerDocsToAttachments(undefined)).toEqual([]);
  });
});
