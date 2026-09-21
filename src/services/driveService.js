/**
 * Google Drive Integration Service using Workspace API & OAuth access token
 */
import { getScopedAccessToken } from './firebase';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

export async function fetchUserDriveFiles() {
  const token = await getScopedAccessToken(DRIVE_SCOPE);

  try {
    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=30&fields=files(id,name,mimeType,webViewLink,thumbnailLink,size)',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Google Drive API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Failed to fetch Google Drive files:', error);
    throw error;
  }
}
