import { auth } from './firebase';

/**
 * ============================================================
 * Print To Frame ERP — Transactional Email Service
 * ============================================================
 * Sends email through the server-side /api/send-email proxy, which holds the
 * info@print2frame.xyz SMTP app password. The credential never reaches the
 * client — only a templateId + interpolation data cross the wire.
 */

/**
 * Sends a templated email (see src/constants/emailTemplates.js for the
 * available templateId values and the {{tokens}} each one expects in `data`).
 */
export async function sendTemplatedEmail(to, templateId, data = {}) {
  if (!auth.currentUser) {
    throw new Error('You must be signed in to send email.');
  }
  const idToken = await auth.currentUser.getIdToken();

  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ to, templateId, data }),
  });

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Invalid response from mail service. Status: ${response.status}. Body: ${text.substring(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(result?.error || `Mail service error (${response.status})`);
  }

  return result;
}
