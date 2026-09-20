import { describe, it, expect } from 'vitest';
import { calculateCost, determineTier, pricingTiers } from '../../src/services/pricingEngine';

describe('pricingEngine', () => {
  describe('determineTier', () => {
    it('returns an empty tier for zero or negative area', () => {
      expect(determineTier(0)).toBe('');
      expect(determineTier(-5)).toBe('');
    });

    it('picks the tier whose upper bound is inclusive', () => {
      expect(determineTier(50)).toBe('0-50');
      expect(determineTier(50.01)).toBe('50-70');
      expect(determineTier(70)).toBe('50-70');
      expect(determineTier(100)).toBe('70-100');
      expect(determineTier(150)).toBe('100-150');
      expect(determineTier(150.01)).toBe('150+');
    });
  });

  describe('calculateCost', () => {
    it('returns null for an unknown tier or non-positive area', () => {
      expect(calculateCost('nope', 10)).toBeNull();
      expect(calculateCost('0-50', 0)).toBeNull();
      expect(calculateCost('0-50', -1)).toBeNull();
    });

    it('builds the cost stack from manufacturing, logistics, QA and sales cost, plus margin', () => {
      const sqFt = 10;
      const t = pricingTiers['0-50'];
      const res = calculateCost('0-50', sqFt);
      const base = sqFt * t.manufRate + t.logistics + t.qa + sqFt * t.costSalesRate;

      expect(res.manufAmount).toBeCloseTo(sqFt * t.manufRate);
      expect(res.logistics).toBe(t.logistics);
      expect(res.qa).toBe(t.qa);
      expect(res.costSalesAmount).toBeCloseTo(sqFt * t.costSalesRate);
      expect(res.profitAndOH).toBeCloseTo(base * t.profitMargin);
      expect(res.totalCost).toBeCloseTo(base * (1 + t.profitMargin));
    });

    // Characterisation: docs/02_modules/cost-calculator-quotation/FINDINGS.md
    // finding 2 (inflexible 15% discount baked into the base function). The
    // discount is applied to every quote with no way to turn it off; the fix
    // (calculateCost takes a discountPct argument, default 0) flips this test.
    it('always takes a hidden 15% discount off the total cost', () => {
      const res = calculateCost('0-50', 10);
      expect(res.discount).toBeCloseTo(res.totalCost * 0.15);
      expect(res.finalAmount).toBeCloseTo(res.totalCost * 0.85);
      expect(res.finalAmountPerSq).toBeCloseTo(res.finalAmount / 10);
    });

    // Characterisation: FINDINGS.md finding 3 (hardcoded 53.5 commission vs
    // partner rates). The 53.5 per sq ft is the tier's costSalesRate, charged
    // regardless of which partner (if any) referred the job. Flips when the
    // commission rate becomes a parameter.
    it('charges a fixed 53.5 per sq ft sales cost in every tier, whatever the partner rate', () => {
      for (const tier of Object.keys(pricingTiers)) {
        const res = calculateCost(tier, 20);
        expect(pricingTiers[tier].costSalesRate).toBe(53.5);
        expect(res.costSalesAmount).toBeCloseTo(20 * 53.5);
      }
    });

    // Characterisation: FINDINGS.md finding 1 (severe "Profit / SQ" error).
    // internalCostPerSq adds logistics, QA and sales cost back onto gross
    // profit before dividing by area; the audit says it should be
    // grossProfit / sqFt. Flips when the formula is corrected.
    it('computes Profit / SQ as (grossProfit + logistics + qa + salesCost) / sqFt', () => {
      const sqFt = 10;
      const res = calculateCost('0-50', sqFt);
      const expected = (res.grossProfit + res.logistics + res.qa + res.costSalesAmount) / sqFt;
      expect(res.internalCostPerSq).toBeCloseTo(expected);
      expect(res.internalCostPerSq).not.toBeCloseTo(res.grossProfit / sqFt);
    });

    it('derives gross profit as final amount less internal manufacturing and sales cost', () => {
      const sqFt = 10;
      const t = pricingTiers['0-50'];
      const res = calculateCost('0-50', sqFt);
      expect(res.internalManufAmount).toBeCloseTo(sqFt * t.internalManufRate);
      expect(res.totalCostOfSales).toBeCloseTo(res.internalManufAmount + sqFt * t.costSalesRate);
      expect(res.grossProfit).toBeCloseTo(res.finalAmount - res.totalCostOfSales);
    });
  });
});
