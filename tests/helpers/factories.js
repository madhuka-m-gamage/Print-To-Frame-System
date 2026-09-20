// Realistic Firestore document factories. Shapes follow what the app actually writes
// (see Leads.jsx handleConvertConfirm, App.jsx handleSaveInvoice/handleGenerateReceipt,
// Partners.jsx handleCreatePartner). Every factory takes an overrides object.
//
// Lineage: matchesEntity (src/utils/entityUtils.js) only recognises id, _firestoreId,
// firestoreId, leadId, dealId, originalLeadId, convertedDealId, rootLeadId and
// businessEntityId. jobNo, linkedJobNo, clientNIC and customerId are NOT matched by it;
// logisticsEngine.calculateCODFromInvoices compares jobNo/linkedJobNo separately.

let seq = 1000;
const next = () => String(++seq);

export function makeLead(overrides = {}) {
  const n = next();
  return {
    id: `L-${n}`,
    name: 'Kasun Perera',
    company: '',
    phone: '+9477 123 4567',
    email: 'kasun@example.com',
    value: 0,
    stage: 'Intake',
    stageEnteredAt: '2026-01-01T00:00:00.000Z',
    source: 'Manual',
    date: '2026-01-01',
    jobScope: '',
    deliveryLocation: '',
    quotationDraft: '',
    quotationGenerated: false,
    isDeal: false,
    convertedToDeal: false,
    convertedDealId: null,
    ...overrides,
  };
}

export function makeDeal(overrides = {}) {
  const n = next();
  const { lead: leadOverride, ...rest } = overrides;
  const lead = leadOverride || makeLead();
  const jobNo = `PTF-${n.slice(-4)}`;
  return {
    ...lead,
    id: `D-${n}`,
    isDeal: true,
    stage: 'Waiting',
    convertedToDeal: false,
    convertedDealId: null,
    originalLeadId: lead.id,
    jobNo,
    linkedJobNo: jobNo,
    value: 100000,
    totalSqFt: 10,
    ...rest,
  };
}

export function makeInvoice(overrides = {}) {
  const { from: src, ...rest } = overrides;
  const type = rest.type || 'Advance';
  const suffix = String(++seq).padStart(4, '0');
  const totalValue = src?.value ?? 100000;
  const amount = type === 'Final' ? totalValue * 0.25 : totalValue * 0.75;
  return {
    id: `INV-${type === 'Final' ? 'FIN' : 'ADV'}-${suffix}`,
    type,
    status: 'Unpaid',
    customerName: src?.name || 'Kasun Perera',
    company: '',
    phone: src?.phone || '+9477 123 4567',
    date: '2026-01-02',
    dueDate: '2026-01-09',
    createdAt: '2026-01-02T00:00:00.000Z',
    amount,
    totalValue,
    leadId: src?.originalLeadId || src?.id || '',
    dealId: src?.isDeal ? src.id : '',
    originalLeadId: src?.originalLeadId || '',
    convertedDealId: src?.convertedDealId || '',
    jobNo: src?.jobNo || '',
    linkedJobNo: src?.linkedJobNo || src?.jobNo || '',
    lineItems: [],
    ...rest,
  };
}

export function makeReceipt(overrides = {}) {
  const { invoice: invOverride, ...rest } = overrides;
  const inv = invOverride || makeInvoice();
  return {
    id: inv.id.replace('INV-', 'REC-'),
    invoiceId: inv.id,
    type: inv.type,
    leadId: inv.leadId || '',
    dealId: inv.dealId || '',
    originalLeadId: inv.originalLeadId || '',
    convertedDealId: inv.convertedDealId || '',
    customerName: inv.customerName,
    company: inv.company,
    partnerId: '',
    amountReceived: inv.amount,
    paymentMethod: 'Cash',
    date: '2026-01-03',
    notes: '',
    createdBy: 'accounts@example.com',
    ...rest,
  };
}

export function makePartner(overrides = {}) {
  const n = next();
  return {
    id: `P-${n}`,
    partnerId: `P-${n}`,
    name: 'Lanka Art Studio',
    type: 'Art & Framing Studio',
    contactPerson: 'Nimal',
    phone: '+9471 234 5678',
    email: 'partner@example.com',
    address: 'Colombo',
    commissionRate: 53.5,
    status: 'Active',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeProject(overrides = {}) {
  const jobNo = overrides.jobNo || `PTF-${next().slice(-4)}`;
  return {
    id: jobNo,
    jobNo,
    title: 'Canvas framing',
    clientNIC: 'Direct Customer',
    customerName: 'Kasun Perera',
    status: 'Pending',
    stageEnteredAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    value: 100000,
    totalSqFt: 10,
    flexReceived: false,
    checklist: {
      materialsCut: false,
      frameWelded: false,
      primerApplied: false,
      canvasWrapped: false,
      qaPassed: false,
    },
    ...overrides,
  };
}

export function makeLogisticsJob(overrides = {}) {
  return {
    id: `L-DL-${next()}`,
    type: 'Delivery',
    subType: 'Finished Steel Frame',
    location: 'Colombo 07',
    customer: 'Kasun Perera',
    customerPhone: '+9477 123 4567',
    status: 'Pending',
    manifest: '',
    driver: '',
    vehicle: '',
    linkedJobNo: '',
    priority: 'Standard',
    createdAt: '2026-01-04T00:00:00.000Z',
    ...overrides,
  };
}

export function makeUser(role = 'Sales', overrides = {}) {
  const email = `${role.toLowerCase().replace(/\s+/g, '.')}-${next()}@example.com`;
  return {
    identifier: email,
    name: `${role} User`,
    role,
    status: 'Active',
    isApproved: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
