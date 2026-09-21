/**
 * String similarity and customer duplicate detection utilities.
 */

// Normalize text: trim, lowercase, remove punctuation
export function normalizeString(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Compute Levenshtein distance between two strings
export function levenshteinDistance(a, b) {
  const strA = normalizeString(a);
  const strB = normalizeString(b);
  if (strA === strB) return 0;
  if (!strA.length) return strB.length;
  if (!strB.length) return strA.length;

  const matrix = [];
  for (let i = 0; i <= strB.length; i++) matrix[i] = [i];
  for (let j = 0; j <= strA.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= strB.length; i++) {
    for (let j = 1; j <= strA.length; j++) {
      if (strB.charAt(i - 1) === strA.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[strB.length][strA.length];
}

// Similarity score from 0.0 to 1.0
export function stringSimilarity(a, b) {
  const normA = normalizeString(a);
  const normB = normalizeString(b);
  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  // Substring match boost
  if (normA.includes(normB) || normB.includes(normA)) {
    const longer = Math.max(normA.length, normB.length);
    const shorter = Math.min(normA.length, normB.length);
    return Math.max(0.75, shorter / longer);
  }

  const distance = levenshteinDistance(normA, normB);
  const maxLength = Math.max(normA.length, normB.length);
  return Math.max(0, 1 - distance / maxLength);
}

/**
 * Find potential duplicate customer profiles from an array of existing customers.
 * @param {Object} candidate - { name, company, phone, email }
 * @param {Array} customerList - Array of existing customer objects
 * @param {number} threshold - Minimum score (default 0.72)
 * @returns {Array} List of matched customers with confidence score
 */
export function findCustomerDuplicates(candidate, customerList = [], threshold = 0.72) {
  if (!candidate || !customerList.length) return [];

  const candidatePhone = candidate.phone ? candidate.phone.replace(/[^\d]/g, '').slice(-9) : '';
  const candidateEmail = candidate.email ? normalizeString(candidate.email) : '';
  const candidateName = normalizeString(candidate.name);
  const candidateCompany = normalizeString(candidate.company || candidate.businessName);

  const matches = [];

  for (const cust of customerList) {
    let score = 0;
    const matchReasons = [];

    // Exact phone match (strongest signal)
    const custPhone = cust.phone ? cust.phone.replace(/[^\d]/g, '').slice(-9) : '';
    if (candidatePhone && custPhone && candidatePhone === custPhone) {
      score = 1.0;
      matchReasons.push('Exact phone match');
    }

    // Exact email match
    const custEmail = cust.email ? normalizeString(cust.email) : '';
    if (candidateEmail && custEmail && candidateEmail === custEmail) {
      score = Math.max(score, 0.95);
      matchReasons.push('Exact email match');
    }

    // Fuzzy name similarity
    if (candidateName && cust.name) {
      const nameSim = stringSimilarity(candidateName, cust.name);
      if (nameSim >= 0.8) {
        score = Math.max(score, nameSim * 0.9);
        matchReasons.push(`Name similarity (${Math.round(nameSim * 100)}%)`);
      }
    }

    // Fuzzy company similarity
    const custCompany = cust.businessName || cust.company;
    if (candidateCompany && custCompany) {
      const compSim = stringSimilarity(candidateCompany, custCompany);
      if (compSim >= 0.8) {
        score = Math.max(score, compSim * 0.85);
        matchReasons.push(`Company match (${Math.round(compSim * 100)}%)`);
      }
    }

    if (score >= threshold) {
      matches.push({
        customer: cust,
        score: Math.round(score * 100) / 100,
        reasons: matchReasons,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}
