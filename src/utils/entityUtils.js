/**
 * ============================================================
 * Print To Frame ERP — Entity Relational Matching Utility
 * ============================================================
 * Resolves ID fragmentation across entity conversion lifecycles
 * (Lead -> Deal -> Project -> Logistics -> Invoice -> Quotation).
 */

/**
 * Extracts all known ID aliases for a given entity or ID representation.
 * @param {Object|string|number} entity - An entity object or identifier
 * @returns {Set<string>} Set of normalized non-empty ID strings
 */
export function getEntityIdSet(entity) {
  const ids = new Set();
  if (!entity) return ids;

  if (typeof entity === 'string' || typeof entity === 'number') {
    const val = String(entity).trim();
    if (val) ids.add(val);
    return ids;
  }

  if (typeof entity !== 'object') return ids;

  const candidateFields = [
    'id',
    '_firestoreId',
    'firestoreId',
    'leadId',
    'dealId',
    'originalLeadId',
    // A Lead converted to a Deal gets a brand new id; originalLeadId above
    // only covers matching FROM the Deal's side back to the Lead it came
    // from. convertedDealId is the Lead's own forward pointer to what it
    // became, needed to match anything created LATER under the Deal's id
    // (e.g. a Final invoice) while still looking at the original Lead record.
    'convertedDealId',
    'rootLeadId',
    'businessEntityId'
  ];

  for (const field of candidateFields) {
    const val = entity[field];
    if (val !== undefined && val !== null) {
      const str = String(val).trim();
      if (str) ids.add(str);
    }
  }

  return ids;
}

/**
 * Checks if a candidate record relates to a target entity or identifier.
 * Returns true if any known ID alias intersects between record and target.
 * @param {Object|string|number} record - Child or related record (e.g. invoice, quote, logistics job)
 * @param {Object|string|number} target - Parent or reference entity (e.g. lead, deal)
 * @returns {boolean} True if the record belongs to the target entity
 */
export function matchesEntity(record, target) {
  if (!record || !target) return false;

  const targetIds = getEntityIdSet(target);
  if (targetIds.size === 0) return false;

  const recordIds = getEntityIdSet(record);
  for (const id of recordIds) {
    if (targetIds.has(id)) return true;
  }

  return false;
}

const isFinalInvoice = (inv) => inv.type === 'Final' || String(inv.id || '').includes('INV-FIN');
const isCancelled = (inv) => ['cancelled', 'void'].includes(String(inv.status || '').toLowerCase());

/**
 * Finds a live Final invoice already issued for an entity (or list of entities).
 * Matches on the shared id aliases and on jobNo / linkedJobNo, and ignores
 * cancelled or void invoices so a voided Final does not block a replacement.
 * Client-side only: two sessions acting at once can still both miss each other.
 * @param {Object[]} invoices
 * @param {Object|Object[]} entity - A lead, deal or project, or several of them
 * @returns {Object|null}
 */
export function getExistingFinalInvoice(invoices, entity) {
  const entities = (Array.isArray(entity) ? entity : [entity]).filter(Boolean);
  const jobNos = new Set(
    entities.flatMap(e => [e.jobNo, e.linkedJobNo]).filter(Boolean).map(String)
  );
  return (invoices || []).find(inv =>
    isFinalInvoice(inv) && !isCancelled(inv) && (
      entities.some(e => matchesEntity(inv, e))
      || jobNos.has(String(inv.jobNo || ''))
      || jobNos.has(String(inv.linkedJobNo || ''))
    )
  ) || null;
}
