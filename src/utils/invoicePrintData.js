// A saved invoice is a snapshot: once it exists, a reprint must show what was issued, not the
// lead's current name or the newest quotation. Draft values are used only before an invoice is saved.
export function resolveInvoiceForPrint({ realInvoice, type, formData = {}, activeQuote, draftTotal = 0 }) {
  const isFinal = type === 'Final';
  const draftAmount = draftTotal * (isFinal ? 0.25 : 0.75);
  const quoteItems = activeQuote?.lineItems?.length ? activeQuote.lineItems : null;

  return {
    id: realInvoice?.id || realInvoice?._firestoreId || `DRAFT-${isFinal ? 'FINAL' : 'ADVANCE'}`,
    type: isFinal ? 'Final' : 'Advance',
    status: realInvoice?.status,
    date: realInvoice?.date,
    dueDate: realInvoice?.dueDate,
    amount: realInvoice?.amount ?? draftAmount,
    totalValue: realInvoice?.totalValue ?? draftTotal,
    lineItems: realInvoice ? (realInvoice.lineItems || quoteItems) : quoteItems,
    aiDraft: realInvoice?.aiDraft || `Scope: ${formData.jobScope || 'Custom metal framing work'}`,
    customerName: realInvoice?.customerName || formData.name,
    company: realInvoice ? (realInvoice.company ?? '') : formData.company,
    phone: realInvoice?.phone || formData.phone,
    linkedJobNo: realInvoice?.linkedJobNo,
  };
}
