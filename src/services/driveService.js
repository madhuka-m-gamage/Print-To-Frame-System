/**
 * Google Drive attachments through Google Picker. The drive.file scope only grants access to the
 * files the user picks, so the app needs no restricted scope and no Google verification.
 */
import { getScopedAccessToken, googleApiConfig } from './firebase';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const PICKER_SCRIPT = 'https://apis.google.com/js/api.js';

export function pickerDocsToAttachments(docs) {
  return (docs || []).map(({ id, name, mimeType, url }) => ({ id, name, mimeType, webViewLink: url }));
}

let pickerReady = null;

function loadPicker() {
  if (!pickerReady) {
    pickerReady = new Promise((resolve, reject) => {
      const fail = () => {
        pickerReady = null;
        reject(new Error('Could not load Google Picker. Check your connection and try again.'));
      };
      const load = () => window.gapi.load('picker', { callback: resolve, onerror: fail });
      if (window.gapi) return load();
      const script = document.createElement('script');
      script.src = PICKER_SCRIPT;
      script.async = true;
      script.onload = load;
      script.onerror = fail;
      document.head.appendChild(script);
    });
  }
  return pickerReady;
}

// Resolves with the picked files, or an empty list when the user cancels.
export async function pickDriveFiles() {
  const token = await getScopedAccessToken(DRIVE_FILE_SCOPE);
  await loadPicker();
  const { picker } = window.google;
  return new Promise((resolve) => {
    new picker.PickerBuilder()
      .addView(new picker.DocsView().setIncludeFolders(true))
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(googleApiConfig.apiKey)
      .setAppId(googleApiConfig.projectNumber)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) resolve(pickerDocsToAttachments(data.docs));
        else if (data.action === picker.Action.CANCEL) resolve([]);
      })
      .build()
      .setVisible(true);
  });
}
