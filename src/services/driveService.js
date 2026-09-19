/**
 * Google Drive Integration Service using Workspace API & OAuth access token
 */
import { getAccessToken } from './firebase';

export async function fetchUserDriveFiles() {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google Workspace. Please sign in with Google.');
  }

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
