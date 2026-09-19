/**
 * ============================================================
 * Print To Frame ERP — Standardized Date & Timestamp Utilities
 * ============================================================
 * Normalizes parsing and formatting across Firestore Timestamp objects,
 * ISO 8601 strings, millisecond numbers, and native Date objects.
 */

/**
 * Converts any timestamp representation into a native JavaScript Date object.
 * Returns null if the value is missing or invalid.
 * @param {Date|Object|string|number} ts - The timestamp to convert
 * @returns {Date|null}
 */
export function toDateObj(ts) {
  if (ts === null || ts === undefined || ts === '') return null;

  if (ts instanceof Date) {
    return isNaN(ts.getTime()) ? null : ts;
  }

  // Firestore Timestamp object (.toDate())
  if (typeof ts.toDate === 'function') {
    try {
      return ts.toDate();
    } catch {
      // fallback
    }
  }

  // Firestore Timestamp object (.toMillis())
  if (typeof ts.toMillis === 'function') {
    try {
      return new Date(ts.toMillis());
    } catch {
      // fallback
    }
  }

  // Firestore raw timestamp { seconds, nanoseconds }
  if (typeof ts === 'object' && typeof ts.seconds === 'number') {
    return new Date(ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000));
  }

  // Numeric epoch
  if (typeof ts === 'number') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }

  // String timestamp
  if (typeof ts === 'string') {
    // If string is purely digits
    if (/^\d+$/.test(ts)) {
      const d = new Date(Number(ts));
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Formats a timestamp as a human-readable date string (e.g. "09 Sep 2026").
 * @param {Date|Object|string|number} ts 
 * @param {string} fallback 
 * @returns {string}
 */
export function formatDate(ts, fallback = '—') {
  const d = toDateObj(ts);
  if (!d) return fallback;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Formats a timestamp with both date and time (e.g. "09 Sep 2026, 14:30").
 * @param {Date|Object|string|number} ts 
 * @param {string} fallback 
 * @returns {string}
 */
export function formatDateTime(ts, fallback = '—') {
  const d = toDateObj(ts);
  if (!d) return fallback;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
