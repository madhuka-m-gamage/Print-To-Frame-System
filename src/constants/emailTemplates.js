/**
 * Email Communication Templates for Print To Frame ERP
 * Used by Administrators, Sales Reps, and Operators to dispatch onboarding credentials,
 * quotations, work order updates, commission statements, and invoices.
 */

export const EMAIL_TEMPLATES = [
  // ── CRM & SALES TEMPLATES ──────────────────────────────────────────────────
  {
    id: 'quote_submission',
    title: 'Formal Quotation Submission (with 75% Advance Terms)',
    category: 'Sales & Quotes',
    description: 'Send itemized steel/canvas framing quotation draft to client with contract terms.',
    targetRoles: ['Business Client', 'Customer', 'Partner'],
    subject: 'Quotation for Steel Framing & Fabrication Work — {{companyName}} [Ref: {{quoteRef}}]',
    body: `Dear {{recipientName}},

Thank you for requesting a quotation from Print To Frame Pvt Ltd.

We have finalized the engineering specifications and pricing for your framing requirements:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JOB & QUOTATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Client / Entity: {{companyName}}
• Project / Scope: {{jobScope}}
• Total Quoted Volume: {{totalSqFt}} SqFt
• Estimated Contract Value: LKR {{totalValue}}
• Initial 75% Advance Due: LKR {{advanceAmount}}
• 25% Balance on Delivery: LKR {{balanceAmount}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PAYMENT TERMS & MOBILIZATION:
1. Production commences upon receipt of the 75% advance payment.
2. The remaining 25% balance is due upon delivery and handover inspection.
3. Bank transfer details are available in the portal or by replying to this email.

To inspect the full line-item quotation and CAD drawings, please visit our client portal at:
{{portalUrl}}

Please let us know if you require any modifications or wish to proceed with work order confirmation.

Best regards,

{{senderName}}
Sales & Estimations Desk
Print To Frame Pvt Ltd
Kadawatha, Sri Lanka
Direct: {{contactPhone}}`,
  },
  {
    id: 'quote_followup',
    title: 'Quotation Follow-Up & Consultation Offer',
    category: 'Sales & Quotes',
    description: 'Polite follow-up for submitted quotations awaiting client confirmation.',
    targetRoles: ['Business Client', 'Customer', 'Partner'],
    subject: 'Follow-Up: Steel Framing Quotation for {{companyName}}',
    body: `Dear {{recipientName}},

I hope this email finds you well.

I am following up on the quotation we submitted recently for your framing and fabrication project ({{companyName}}).

Our workshop team is currently scheduling steel procurement and cutting schedules for the upcoming week. If you have any technical questions regarding profile dimensions, powder coating finishes, or tension mounting mechanisms, our chief engineer is available for a quick call.

If you are ready to proceed or would like us to revise the specifications to align with your budget, please reply to this email or call us at {{contactPhone}}.

We look forward to partnering with you!

Warm regards,

{{senderName}}
Print To Frame Pvt Ltd`,
  },

  // ── BILLING & FINANCE TEMPLATES ───────────────────────────────────────────
  {
    id: 'advance_invoice_reminder',
    title: '75% Advance Invoice & Mobilization Notice',
    category: 'Billing & Accounts',
    description: 'Payment request for 75% advance required before starting factory fabrication.',
    targetRoles: ['Business Client', 'Customer'],
    subject: 'Invoice for 75% Advance — {{companyName}} [{{invoiceId}}]',
    body: `Dear {{recipientName}},

Please find the 75% advance mobilization invoice for your confirmed framing work order with Print To Frame.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVOICE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Invoice Number: {{invoiceId}}
• Customer / Entity: {{companyName}}
• Total Job Value: LKR {{totalValue}}
• Advance Payable (75%): LKR {{advanceAmount}}
• Payment Due Date: {{dueDate}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BANK SETTLEMENT DETAILS:
• Bank Name: Commercial Bank of Ceylon / Sampath Bank
• Account Name: Print To Frame (Pvt) Ltd
• Account Number: 1000 4589 2310
• Branch: Kadawatha Branch
• Reference: {{invoiceId}} / {{companyName}}

Please email your payment confirmation slip to {{supportEmail}} so our workshop can immediately queue steel cutting and assembly.

Thank you for your business!

Sincerely,

{{senderName}}
Finance & Accounts Department
Print To Frame Pvt Ltd`,
  },
  {
    id: 'final_handover_balance',
    title: '25% Final Settlement Notice & Handover',
    category: 'Billing & Accounts',
    description: 'Final payment notice upon job completion and dispatch delivery.',
    targetRoles: ['Business Client', 'Customer'],
    subject: 'Final Settlement Invoice & Delivery Handover — {{companyName}} [{{invoiceId}}]',
    body: `Dear {{recipientName}},

We are delighted to confirm that the framing fabrication for {{companyName}} has been successfully completed and delivered!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL SETTLEMENT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Job Reference: {{jobScope}}
• Total Job Value: LKR {{totalValue}}
• Advance Paid (75%): LKR {{advanceAmount}}
• Final Balance Due (25%): LKR {{balanceAmount}}
• Handover Date: {{deliveryDate}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please settle the outstanding balance of LKR {{balanceAmount}} at your earliest convenience using our bank details or through the portal payment gateway at {{portalUrl}}.

Thank you for placing your trust in Print To Frame engineering!

Best regards,

{{senderName}}
Accounts Desk
Print To Frame Pvt Ltd`,
  },

  // ── OPERATIONS & PRODUCTION TEMPLATES ─────────────────────────────────────
  {
    id: 'production_commenced',
    title: 'Factory Work Order Commenced (Cutting & Assembly)',
    category: 'Operations',
    description: 'Notification to client that steel framing fabrication has officially started.',
    targetRoles: ['Business Client', 'Customer', 'Partner'],
    subject: 'Production Update: Work Order Commenced on Factory Floor — {{companyName}}',
    body: `Dear {{recipientName}},

We are excited to update you that your steel framing order for {{companyName}} has entered our factory production line!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCTION MILESTONES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Work Order ID: {{jobNo}}
• Specifications: {{jobScope}}
• Current Stage: Precision Cutting, Box Iron Welding & Mitre Alignment
• Estimated QA Inspection: {{qaDate}}
• Target Handover Date: {{deliveryDate}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Our fabrication specialists ensure all frames undergo 100% tension stress analysis and anti-corrosion priming before delivery.

You can monitor real-time fabrication stages through your portal account:
{{portalUrl}}

Best regards,

{{senderName}}
Operations & Fabrication Desk
Print To Frame Workshop
Kadawatha, Sri Lanka`,
  },
  {
    id: 'fabrication_ready_inspection',
    title: 'Fabrication Complete — Ready for Quality Inspection',
    category: 'Operations',
    description: 'Alert client or partner that framing is built and passed workshop QA.',
    targetRoles: ['Business Client', 'Customer', 'Partner'],
    subject: 'Quality Assurance Passed — Frames Ready for Inspection [{{jobNo}}]',
    body: `Dear {{recipientName}},

Good news! The framing work order for {{companyName}} has successfully passed our workshop quality assurance inspection.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FABRICATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Job Number: {{jobNo}}
• Completed Scope: {{jobScope}}
• Total Volume: {{totalSqFt}} SqFt
• Status: 100% Assembled, Quality Checked, and Wrapped
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The frames are currently staged in our loading bay. If you would like to conduct an in-person inspection or arrange scheduled pickup, please contact our dispatch team at {{contactPhone}}.

Best regards,

{{senderName}}
Quality Assurance & Workshop Manager
Print To Frame Pvt Ltd`,
  },

  // ── LOGISTICS & DISPATCH TEMPLATES ────────────────────────────────────────
  {
    id: 'dispatch_scheduled',
    title: 'Logistics & Dispatch Scheduled (Driver Details)',
    category: 'Logistics',
    description: 'Send delivery schedule, driver contact, and destination waypoint to client.',
    targetRoles: ['Business Client', 'Customer', 'Partner'],
    subject: 'Delivery Dispatch Scheduled — Print To Frame [{{jobNo}}]',
    body: `Dear {{recipientName}},

Your finished framing consignment has been scheduled for dispatch and delivery!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISPATCH DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Consignment Ref: {{jobNo}}
• Destination: {{deliveryAddress}}
• Scheduled Delivery Date & Time: {{deliveryTime}}
• Transport Vehicle: {{vehicleNumber}}
• Driver / Dispatch Officer: {{driverName}} ({{driverPhone}})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SPECIAL HANDLING NOTES:
Our delivery team will handle unloading with protective corner guards. Please ensure the designated site representative is available for handover sign-off.

For any live location queries, feel free to call our dispatch desk at {{contactPhone}}.

Best regards,

{{senderName}}
Logistics & Transport Desk
Print To Frame Pvt Ltd`,
  },

  // ── PARTNER NETWORK & COMMISSIONS ─────────────────────────────────────────
  {
    id: 'commission_disbursement',
    title: 'Framing Partner Commission Statement',
    category: 'Partners',
    description: 'Monthly or per-job commission breakdown statement for framing partners.',
    targetRoles: ['Partner'],
    subject: 'Partner Commission Disbursement Statement — {{partnerId}} [Print To Frame]',
    body: `Dear {{recipientName}},

We are pleased to provide your partner commission statement for completed framing referral jobs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMMISSION STATEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Partner Name: {{recipientName}}
• Partner ID: {{partnerId}}
• Total Volume Delivered: {{totalSqFt}} SqFt
• Your Partner Rate: LKR {{commissionRate}} per SqFt
• Total Commission Payable: LKR {{commissionAmount}}
• Disbursement Status: Processed / Transferred to Bank
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BANK REMITTANCE DETAILS:
The funds have been credited to your registered bank account. You can also view historical earnings and download PDF receipts directly from your Partner Portal:
{{portalUrl}}

Thank you for being an esteemed partner in our framing network!

Warm regards,

{{senderName}}
Partner Network & Accounts
Print To Frame Pvt Ltd`,
  },
  {
    id: 'partner_approval',
    title: 'Partner Application Approved (Welcome & Activation)',
    category: 'Partners',
    description: 'Welcome email with partner ID and login credentials for approved framing & art partners.',
    targetRoles: ['Partner'],
    subject: 'Welcome to the Print To Frame Partner Network — Your Account is Ready [{{partnerId}}]',
    body: `Dear {{recipientName}},

We are pleased to inform you that your application to join the Print To Frame Partner Network has been approved!

Your partner account and workspace access are now active with the following details:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTNER ACCOUNT CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Partner Name: {{recipientName}}
• Partner ID: {{partnerId}}
• Assigned Role: Art & Framing Partner
• Your Commission Rate: LKR {{commissionRate}} per SqFt
• Portal URL: {{portalUrl}}
• Username / Email: {{loginEmail}}
• Temporary Password: {{tempPassword}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEXT STEPS:
1. Log in to the Print To Frame Portal at {{portalUrl}}
2. Access your assigned fabrication jobs, submit orders, and track commission disbursements.
3. For security, please update your temporary password in the "My Profile" tab upon your first login.

If you have any questions or require technical assistance, feel free to reply directly to this email or reach our operations desk at {{contactPhone}}.

We look forward to a fruitful and successful partnership!

Warm regards,

{{senderName}}
Print To Frame Pvt Ltd
Kadawatha, Sri Lanka
Web: {{portalUrl}}`,
  },
  {
    id: 'partner_activation_confirmed',
    title: 'Partner Account Fully Activated (Self-Registered)',
    category: 'Partners',
    description: 'Confirms a self-registered partner\'s account is fully active once their profile is completed — no password included, since they already set their own when they registered.',
    targetRoles: ['Partner'],
    subject: 'Your Print To Frame Partner Account is Now Fully Active [{{partnerId}}]',
    body: `Dear {{recipientName}},

Great news — your Print To Frame Partner account is now fully active and ready to use.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTNER ACCOUNT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Partner Name: {{recipientName}}
• Partner ID: {{partnerId}}
• Your Commission Rate: LKR {{commissionRate}} per SqFt
• Portal URL: {{portalUrl}}
• Login Email: {{loginEmail}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Log in at {{portalUrl}} using the password you set when you registered — your referral QR code and commission tracking are ready in your Partner Portal.

If you have any questions, feel free to reply directly to this email or reach our operations desk at {{contactPhone}}.

We look forward to a fruitful and successful partnership!

Warm regards,

{{senderName}}
Print To Frame Pvt Ltd
Kadawatha, Sri Lanka`,
  },

  // ── CORPORATE CLIENTS & WORKSPACE ─────────────────────────────────────────
  {
    id: 'client_approval',
    title: 'Business Client B2B Access Activated',
    category: 'Corporate B2B',
    description: 'Account activation notice for approved corporate buyers, architecture firms, and wholesale clients.',
    targetRoles: ['Business Client'],
    subject: 'Print To Frame B2B Corporate Portal Access Activated — {{companyName}}',
    body: `Dear {{recipientName}},

Thank you for choosing Print To Frame as your commercial framing and fabrication partner.

Your corporate account for {{companyName}} has been approved and activated with authorized B2B portal privileges.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORPORATE ACCESS DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Company / Entity: {{companyName}}
• Primary Contact: {{recipientName}}
• Account Type: Corporate Client (B2B)
• Portal URL: {{portalUrl}}
• User Login: {{loginEmail}}
• Temporary Password: {{tempPassword}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PORTAL CAPABILITIES:
• Submit custom steel & canvas framing work orders directly to our factory floor.
• Review live line-item quotations and CAD structural blueprints.
• Track job progress through Fabrication, Ready to Load, and Final Handover stages.
• View and download advance (75%) and final (25%) settlement invoices.

Please log in at {{portalUrl}} to review your active dashboard.

Best regards,

{{senderName}}
Corporate Accounts Desk
Print To Frame Pvt Ltd
Kadawatha, Sri Lanka`,
  },
  {
    id: 'client_activation_confirmed',
    title: 'Business Client Account Fully Activated (Self-Registered)',
    category: 'Corporate B2B',
    description: 'Confirms a self-registered business client\'s account is fully active once their profile is completed — no password included, since they already set their own when they registered.',
    targetRoles: ['Business Client'],
    subject: 'Your Print To Frame Corporate Portal Access is Now Fully Active — {{companyName}}',
    body: `Dear {{recipientName}},

Thank you for registering with Print To Frame. Your corporate account for {{companyName}} is now fully active.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORPORATE ACCESS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Company / Entity: {{companyName}}
• Primary Contact: {{recipientName}}
• Portal URL: {{portalUrl}}
• Login Email: {{loginEmail}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Log in at {{portalUrl}} using the password you set when you registered, to submit work orders, review quotations, and track invoices.

Best regards,

{{senderName}}
Corporate Accounts Desk
Print To Frame Pvt Ltd
Kadawatha, Sri Lanka`,
  },
  {
    id: 'employee_invite',
    title: 'New Team Member Workspace Onboarding',
    category: 'Internal Team',
    description: 'Internal credentials and onboarding instructions for staff members.',
    targetRoles: ['Admin', 'Manager', 'Sales', 'Operations', 'Support', 'Accounts', 'Logistics'],
    subject: 'Welcome to the Print To Frame Team — Your Workspace Access [{{assignedRole}}]',
    body: `Hi {{recipientName}},

Welcome to the Print To Frame team!

Your workspace user account has been provisioned on the ERP system with the {{assignedRole}} role.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WORKSPACE CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Full Name: {{recipientName}}
• Assigned Department / Role: {{assignedRole}}
• Portal URL: {{portalUrl}}
• Login Email: {{loginEmail}}
• Initial Password: {{tempPassword}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please sign in at {{portalUrl}}, familiarize yourself with your department modules, and update your profile picture in the "My Profile" tab.

Welcome aboard, and let's build great things together!

Best regards,

{{senderName}}
Print To Frame Pvt Ltd`,
  },
  {
    id: 'password_reset',
    title: 'Password Reset & Account Security Notice',
    category: 'Security',
    description: 'Send temporary password or login instructions to a user who requested a reset.',
    targetRoles: ['Admin', 'Manager', 'Sales', 'Operations', 'Support', 'Accounts', 'Logistics', 'Partner', 'Business Client'],
    subject: 'Password Reset Instructions for Your Print To Frame Account',
    body: `Dear {{recipientName}},

We received a request to reset the password for your Print To Frame account ({{loginEmail}}).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPORARY CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Portal URL: {{portalUrl}}
• User ID: {{loginEmail}}
• Temporary Access Code: {{tempPassword}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please log in to {{portalUrl}} using the temporary credentials above, then immediately navigate to "My Profile" to set a secure permanent password.

If you did not request this password reset, please notify our security team immediately at {{supportEmail}}.

Sincerely,

{{senderName}}
Security & Systems Administration
Print To Frame Pvt Ltd`,
  },
  {
    id: 'request_info',
    title: 'Application Needs Additional Information',
    category: 'Verification',
    description: 'Request additional documentation, BRN, or portfolio samples from applicants.',
    targetRoles: ['Partner', 'Business Client'],
    subject: 'Action Required: Print To Frame Application Review for {{recipientName}}',
    body: `Dear {{recipientName}},

Thank you for your interest in registering with Print To Frame for {{requestedRole}} access.

During our review of your application, our team noticed that we need a few additional details before we can complete your account activation:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUESTED INFORMATION / DOCUMENTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{missingDetails}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please reply directly to this email with the requested information at your earliest convenience so we can proceed with your verification.

Thank you for your cooperation.

Sincerely,

{{senderName}}
Partner Verification Desk
Print To Frame Pvt Ltd`,
  },
  {
    id: 'registration_declined',
    title: 'Registration Request Declined',
    category: 'Verification',
    description: 'Notifies an applicant that their registration or partner-application request was not approved. Sent automatically when a request is declined in User Management.',
    targetRoles: ['Partner', 'Business Client', 'Customer'],
    subject: 'Update on Your Print To Frame Registration Request',
    body: `Dear {{recipientName}},

Thank you for your interest in Print To Frame.

After reviewing your registration request, we're unable to approve it at this time.

If you believe this was in error, or would like more information, please reply directly to this email or contact us at {{supportEmail}}.

Thank you for your understanding.

Sincerely,

{{senderName}}
Print To Frame Pvt Ltd`,
  },
  {
    id: 'job_completion_feedback',
    title: 'Job Completion & Customer Feedback Request',
    category: 'Customer Success',
    description: 'Follow-up email requesting customer review and feedback after successful delivery.',
    targetRoles: ['Business Client', 'Customer'],
    subject: 'How Was Your Framing Experience with Print To Frame? [{{companyName}}]',
    body: `Dear {{recipientName}},

Thank you for partnering with Print To Frame for your recent framing and fabrication project.

Our goal is to deliver world-class precision engineering and art framing that exceeds expectations. We would love to hear your feedback on the build quality, delivery timeliness, and communication.

If you have a brief moment, please reply to this email with your feedback, or let us know if there are any upcoming projects we can assist you with.

Thank you once again for choosing Print To Frame!

Warm regards,

{{senderName}}
Customer Experience Desk
Print To Frame Pvt Ltd
Kadawatha, Sri Lanka
Web: {{portalUrl}}`,
  },
];

/**
 * Replace placeholders like {{key}} with matching value from data object.
 * Missing keys default to a clean placeholder or fallback.
 */
export const interpolateTemplate = (templateString, data = {}) => {
  if (!templateString) return '';
  return templateString.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    if (data[key] !== undefined && data[key] !== null && String(data[key]).trim() !== '') {
      return String(data[key]);
    }
    // Fallback defaults for common keys
    switch (key) {
      case 'portalUrl':
        return typeof window !== 'undefined' ? window.location.origin : 'https://portal.print2frame.xyz';
      case 'contactPhone':
        return '+94 71 141 9027';
      case 'supportEmail':
        return 'support@print2frame.xyz';
      case 'tempPassword':
        return '[Password provided on account creation]';
      case 'partnerId':
        return 'P-PARTNER';
      case 'senderName':
        return 'Administration Team';
      case 'quoteRef':
        return 'QT-PREVIEW';
      case 'jobScope':
        return 'Custom Steel Frame Fabrication & Gallery Tension Mounting';
      case 'totalSqFt':
        return '120.00';
      case 'totalValue':
        return '240,000.00';
      case 'advanceAmount':
        return '180,000.00';
      case 'balanceAmount':
        return '60,000.00';
      case 'commissionAmount':
        return '6,420.00';
      case 'commissionRate':
        return '53.50';
      case 'invoiceId':
        return 'INV-' + String(Date.now()).slice(-6);
      case 'jobNo':
        return 'JOB-' + String(Date.now()).slice(-6);
      case 'dueDate':
        return 'Within 7 Days';
      case 'deliveryDate':
        return 'Scheduled Handover';
      case 'qaDate':
        return 'Tomorrow, 4:00 PM';
      case 'deliveryAddress':
        return 'Client Designated Site / Gallery';
      case 'deliveryTime':
        return '10:00 AM – 2:00 PM';
      case 'vehicleNumber':
        return 'WP-CAR-7845';
      case 'driverName':
        return 'Kasun Perera';
      case 'driverPhone':
        return '+94 77 345 8912';
      case 'missingDetails':
        return '• Business Registration Number (BRN) copy\n• Workshop location & sample portfolio';
      case 'reason':
        return 'Incomplete registration details or unverified business credentials.';
      default:
        return match;
    }
  });
};
