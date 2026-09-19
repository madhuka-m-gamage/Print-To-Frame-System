/**
 * Canonical System Roles & RBAC Definitions
 * Print To Frame ERP Core
 */

export const SYSTEM_ROLES = [
  'Admin',
  'Manager',
  'Sales',
  'Operations',
  'Support',
  'Accounts',
  'Logistics',
  'Partner',
  'Business Client',
  'Customer',
];

export const PUBLIC_REGISTRATION_ROLES = [
  'Partner',
  'Business Client',
];

export const ROLE_CATEGORIES = {
  EXECUTIVE: ['Admin', 'Manager'],
  FRONT_OFFICE: ['Sales', 'Support'],
  OPERATIONS: ['Operations', 'Logistics'],
  FINANCE: ['Accounts'],
  EXTERNAL: ['Partner', 'Business Client', 'Customer'],
};

export const ROLE_METADATA = {
  Admin: {
    label: 'Super Administrator',
    desc: 'Unrestricted full system authority and security matrix access',
    badge: 'bg-primary/20 text-primary border-primary/40',
    category: 'Executive',
  },
  Manager: {
    label: 'Operations Manager',
    desc: 'Full operational & CRM overview, pricing engine, reports, user inspection',
    badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
    category: 'Executive',
  },
  Sales: {
    label: 'Sales Representative',
    desc: 'Lead intake, deals negotiation, quotation drafting, customer registry',
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    category: 'Front-Office',
  },
  Support: {
    label: 'Customer Support',
    desc: 'Client inquiry handling, status tracking, messages',
    badge: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
    category: 'Front-Office',
  },
  Operations: {
    label: 'Fabrication Master',
    desc: 'Factory work orders, cutting schedules, CAD blueprints',
    badge: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    category: 'Operations',
  },
  Logistics: {
    label: 'Logistics & Dispatch',
    desc: 'Dispatching, delivery tracking, driver waypoints, loading manifests',
    badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40',
    category: 'Operations',
  },
  Accounts: {
    label: 'Accounts & Billing',
    desc: 'Invoices, payments, expense reconciliation, cost analysis',
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    category: 'Finance',
  },
  Partner: {
    label: 'Art & Framing Partner',
    desc: 'Framing artisans, print agencies, subcontracted workshops',
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    category: 'External',
  },
  'Business Client': {
    label: 'Corporate Client (B2B)',
    desc: 'Enterprise accounts, architects, commercial framing projects',
    badge: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    category: 'External',
  },
  Customer: {
    label: 'Individual Customer',
    desc: 'Direct retail framing clients',
    badge: 'bg-surface-container-high text-on-surface-variant border-outline-variant',
    category: 'External',
  },
};

export const getRoleCategory = (role) => {
  if (['Admin', 'Manager'].includes(role)) return 'Executive';
  if (['Sales', 'Support'].includes(role)) return 'Front-Office';
  if (['Operations', 'Logistics'].includes(role)) return 'Operations';
  if (['Accounts'].includes(role)) return 'Finance';
  if (role === 'Partner') return 'Partners';
  if (['Business Client', 'Customer'].includes(role)) return 'Clients';
  return 'Employees';
};
