// One shape for every logistics task, whichever screen creates it: Deals, Leads and Fabrication
// all dispatch through this, so the card, the WhatsApp notice and the COD lookup can rely on
// customerPhone, linkedJobNo, the entity ids, priority and createdAt being there.
export function buildLogisticsTask({
  id, type, subType, location, customer, customerPhone = '', company = '', manifest = null,
  linkedJobNo = '', dealId = '', leadId = '',
}) {
  return {
    id,
    type,
    subType,
    location,
    customer,
    customerPhone: customerPhone || '',
    company,
    status: 'Pending',
    priority: 'Standard',
    startTime: null,
    endTime: null,
    duration: null,
    manifest,
    driver: '',
    vehicle: '',
    notified: false,
    lastNotifiedAt: null,
    linkedJobNo,
    dealId,
    leadId,
    createdAt: new Date().toISOString(),
  };
}

// What fabrication sees on the linked project. Only delivery tasks report back; a task moved back
// to Pending clears the flag.
export function deliveryStatusForTask(task, newStatus) {
  if (task?.type !== 'Delivery') return undefined;
  if (newStatus === 'In Transit') return 'in_transit';
  if (newStatus === 'Completed') return 'delivered';
  return null;
}
