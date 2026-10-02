/**
 * Splits a contract total into the 75% Advance and the Final balance. The
 * Advance is rounded half up to cents and the Final is the remainder, so the
 * two always add up to the total exactly.
 * @returns {{ advance: number, final: number }}
 */
export function splitInvoiceAmounts(total) {
  const totalCents = Math.max(0, Math.round((Number(total) || 0) * 100));
  const advanceCents = Math.floor((3 * totalCents + 2) / 4);
  return { advance: advanceCents / 100, final: (totalCents - advanceCents) / 100 };
}
