import { describe, it, expect } from 'vitest';
import { EMAIL_TEMPLATES, interpolateTemplate } from '../../src/constants/emailTemplates.js';

describe('interpolateTemplate', () => {
  it('substitutes every {{token}} present in the supplied data', () => {
    const result = interpolateTemplate('Hello {{name}}, your role is {{role}}.', {
      name: 'Jane',
      role: 'Sales',
    });
    expect(result).toBe('Hello Jane, your role is Sales.');
  });

  it('falls back to the built-in default for a known token with no data', () => {
    expect(interpolateTemplate('Contact: {{supportEmail}}', {})).toBe(
      'Contact: support@print2frame.xyz'
    );
  });

  it('treats an empty-string or whitespace-only value as absent and uses the fallback', () => {
    expect(interpolateTemplate('Phone: {{contactPhone}}', { contactPhone: '   ' })).toBe(
      'Phone: +94 71 141 9027'
    );
  });

  it('leaves an unknown token with no fallback untouched rather than silently dropping it', () => {
    // If this ever starts returning '', a real email could go out with a blank
    // field and no trace of what was supposed to be there — better to leave the
    // {{token}} visible so a bad send is obvious instead of silent.
    expect(interpolateTemplate('Value: {{totallyUnknownToken}}', {})).toBe(
      'Value: {{totallyUnknownToken}}'
    );
  });

  it('returns an empty string for a null/undefined template rather than throwing', () => {
    expect(interpolateTemplate(undefined, { name: 'Jane' })).toBe('');
    expect(interpolateTemplate('', { name: 'Jane' })).toBe('');
  });
});

describe('EMAIL_TEMPLATES', () => {
  it('has no duplicate template ids', () => {
    const ids = EMAIL_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has a non-empty subject and body', () => {
    for (const t of EMAIL_TEMPLATES) {
      expect(t.subject, `template "${t.id}" subject`).toBeTruthy();
      expect(t.body, `template "${t.id}" body`).toBeTruthy();
    }
  });

  it('the templates the enroll/reset-password flows depend on still exist', () => {
    // api/send-email.js and the Phase 3/5 enrollment work look these up by id —
    // if either is ever renamed here without updating the callers, sends would
    // start failing with "Unknown templateId" at send time, not at build time.
    expect(EMAIL_TEMPLATES.find(t => t.id === 'employee_invite')).toBeTruthy();
    expect(EMAIL_TEMPLATES.find(t => t.id === 'password_reset')).toBeTruthy();
  });

  it('fully interpolating every template leaves no unresolved {{tokens}} behind', () => {
    const sampleData = {
      recipientName: 'Jane Fernando',
      companyName: 'Fernando Framing Studio',
      partnerId: 'P-1001',
      loginEmail: 'jane@example.com',
      tempPassword: 'Sample123!',
      assignedRole: 'Sales',
      requestedRole: 'Partner Access',
      contactPhone: '+94 71 000 0000',
      portalUrl: 'https://portal.print2frame.xyz',
      senderName: 'Admin Desk',
      supportEmail: 'support@print2frame.xyz',
      quoteRef: 'QT-0001',
      jobScope: 'Custom Framing',
      totalSqFt: '100.00',
      totalValue: '100,000.00',
      advanceAmount: '75,000.00',
      balanceAmount: '25,000.00',
      commissionAmount: '5,000.00',
      invoiceId: 'INV-ADV-0001',
      jobNo: 'JOB-0001',
      dueDate: 'Within 7 Days',
      deliveryDate: 'Tomorrow',
      qaDate: 'Tomorrow',
      deliveryAddress: '123 Main St',
      deliveryTime: '10:00 AM',
      vehicleNumber: 'WP-CAR-0000',
      driverName: 'Test Driver',
      driverPhone: '+94 77 000 0000',
    };
    const unresolvedTokenPattern = /\{\{[a-zA-Z0-9_]+\}\}/;
    for (const t of EMAIL_TEMPLATES) {
      const subject = interpolateTemplate(t.subject, sampleData);
      const body = interpolateTemplate(t.body, sampleData);
      expect(unresolvedTokenPattern.test(subject), `template "${t.id}" subject: ${subject}`).toBe(false);
      expect(unresolvedTokenPattern.test(body), `template "${t.id}" body left unresolved tokens`).toBe(false);
    }
  });
});
