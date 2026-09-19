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

