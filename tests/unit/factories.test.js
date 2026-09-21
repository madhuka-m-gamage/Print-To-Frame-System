import { describe, it, expect } from 'vitest';
import { matchesEntity } from '@/shared/utils/entityUtils';
import {
  makeLead, makeDeal, makeInvoice, makeReceipt, makePartner,
  makeProject, makeLogisticsJob, makeUser,
} from '../helpers/factories';

describe('test factories', () => {
  it('links a deal to the lead it came from', () => {
    const lead = makeLead();
    const deal = makeDeal({ lead });
    expect(matchesEntity(deal, lead)).toBe(true);
  });

  it('links a lead to its deal through convertedDealId', () => {
    const deal = makeDeal();
    const lead = makeLead({ id: deal.originalLeadId, convertedDealId: deal.id });
    expect(matchesEntity(lead, deal)).toBe(true);
  });

  it('links an invoice built from a deal to that deal and its original lead', () => {
    const lead = makeLead();
    const deal = makeDeal({ lead });
    const invoice = makeInvoice({ type: 'Final', from: deal });
    expect(invoice.id).toMatch(/^INV-FIN-\d{4}$/);
    expect(matchesEntity(invoice, deal)).toBe(true);
    expect(matchesEntity(invoice, lead)).toBe(true);
  });

  it('links a receipt to its invoice lineage', () => {
    const deal = makeDeal();
    const invoice = makeInvoice({ from: deal });
    const receipt = makeReceipt({ invoice });
    expect(receipt.id).toMatch(/^REC-ADV-/);
    expect(matchesEntity(receipt, deal)).toBe(true);
  });

  it('does not link unrelated entities', () => {
    expect(matchesEntity(makeInvoice({ from: makeDeal() }), makeDeal())).toBe(false);
  });

  it('does not match by jobNo alone, which entityUtils does not recognise', () => {
    const deal = makeDeal();
    const project = makeProject({ jobNo: deal.jobNo });
    const logistics = makeLogisticsJob({ linkedJobNo: deal.jobNo });
    expect(matchesEntity(project, deal)).toBe(false);
    expect(matchesEntity(logistics, deal)).toBe(false);
  });

  it('applies overrides and produces unique ids', () => {
    expect(makeLead({ name: 'X' }).name).toBe('X');
    expect(makeLead().id).not.toBe(makeLead().id);
    expect(makePartner().partnerId).toMatch(/^P-/);
    expect(makeUser('Partner').role).toBe('Partner');
  });
});
