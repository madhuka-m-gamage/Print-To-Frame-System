import { addDocument, COLLECTIONS } from './firestoreSync';

/**
 * Log an activity to the audit trail.
 * @param {string} userId - The user's ID/email who performed the action
 * @param {string} userName - The user's display name
 * @param {string} action - e.g., 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
 * @param {string} module - e.g., 'Leads', 'Invoices', 'Partners'
 * @param {string} details - Human readable details about the action
 */
export async function logActivity(userId, userName, action, module, details) {
  try {
    if (!userId) return; // Cannot log without user context
    await addDocument(COLLECTIONS.AUDIT_LOG, {
      userId,
      userName: userName || userId,
      action,
      module,
      details,
    });
  } catch (error) {
    console.error('[AuditLog] Error logging activity:', error);
  }
}
