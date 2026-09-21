// An Invoiced quotation is one that was Accepted and has since produced its Advance
// invoice, so everything that treats a quote as accepted must accept both.
export const isAcceptedQuote = (status) => status === 'Accepted' || status === 'Invoiced';
