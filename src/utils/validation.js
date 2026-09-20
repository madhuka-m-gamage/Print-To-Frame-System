// src/utils/validation.js

export const validatePhone = (phone) => {
  // Matches Sri Lankan format: +947X XXXX XXX or similar variations
  // Let's strip spaces first for easier testing
  const cleaned = phone.replace(/\s+/g, '');
  // +94 followed by 7, then a digit, then 7 digits. Total 12 characters
  const phoneRegex = /^\+947\d{8}$/;
  return phoneRegex.test(cleaned);
};

export const formatPhone = (phone) => {
  // Auto-format to +947X XXXX XXX
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it starts with 07, convert to +947
  let normalized = cleaned;
  if (normalized.startsWith('07')) {
    normalized = '+94' + normalized.substring(1);
  }
  
  if (normalized.length <= 4) return normalized;
  if (normalized.length <= 8) return `${normalized.substring(0, 5)} ${normalized.substring(5)}`;
  
  return `${normalized.substring(0, 5)} ${normalized.substring(5, 9)} ${normalized.substring(9, 12)}`;
};

// Canonical digits-only form with the Sri Lankan country code, so "+94 71 234 5678",
// "0712345678" and "94712345678" compare equal. Empty input yields '' (never a match).
export const normalizePhone = (phone) => {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return '94' + digits.slice(1);
  if (digits.length === 9) return '94' + digits;
  return digits;
};

export const phonesMatch = (a, b) => {
  const na = normalizePhone(a);
  return na !== '' && na === normalizePhone(b);
};

export const validateEmail = (email) => {
  if (!email) return true; // Optional by default in our forms
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Universal technical text sanitizer to remove emojis, pictographs, decorative symbols,
 * and convert informal notes into clean, professional engineering briefs.
 */
export const stripEmojis = (str) => {
  if (!str || typeof str !== 'string') return '';
  
  // Use modern standard Unicode property escapes for Emoji and Symbols
  return str
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    // Clean up multiple trailing/leading spaces created after emoji removal
    .replace(/[ \t]+/g, ' ')
    .replace(/^[ \t]*[-*•][ \t]*/gm, '- ') // normalize bullet points to standard technical dash
    .trim();
};

/**
 * Sanitizes and standardizes a job scope into a clean engineering specification
 */
export const sanitizeTechnicalScope = (scope) => {
  if (!scope) return '';
  const cleaned = stripEmojis(scope);
  return cleaned;
};

