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

    it('builds the cost stack from manufacturing, logistics, QA and commission, plus margin', () => {
      const sqFt = 10;
      const t = pricingTiers['0-50'];
      const res = calculateCost('0-50', sqFt, 0, 60);
      const base = sqFt * t.manufRate + t.logistics + t.qa + sqFt * 60;

      expect(res.manufAmount).toBeCloseTo(sqFt * t.manufRate);
      expect(res.logistics).toBe(t.logistics);
      expect(res.qa).toBe(t.qa);
      expect(res.costSalesAmount).toBeCloseTo(sqFt * 60);
      expect(res.profitAndOH).toBeCloseTo(base * t.profitMargin);
      expect(res.totalCost).toBeCloseTo(base * (1 + t.profitMargin));
    });

    // Flipped in Phase 7 6.6 (cost-calculator-quotation finding 2): the discount is a parameter
    // that defaults to none, no longer a hidden 15% on every quote.
    it('applies no discount by default and the given percentage when asked', () => {
      const none = calculateCost('0-50', 10);
      expect(none.discount).toBe(0);
      expect(none.finalAmount).toBeCloseTo(none.totalCost);
      const fifteen = calculateCost('0-50', 10, 15);
      expect(fifteen.discount).toBeCloseTo(fifteen.totalCost * 0.15);
      expect(fifteen.finalAmount).toBeCloseTo(fifteen.totalCost * 0.85);
      expect(fifteen.discountPct).toBe(15);
      expect(fifteen.finalAmountPerSq).toBeCloseTo(fifteen.finalAmount / 10);
    });

    // Flipped in Phase 7 6.6 (finding 3): commission is a parameter, 0 for a direct lead and the
    // partner's own rate for a referral.
    it('charges no commission by default and the partner rate when given', () => {
      for (const tier of Object.keys(pricingTiers)) {
        expect(calculateCost(tier, 20).costSalesAmount).toBe(0);
        expect(calculateCost(tier, 20, 0, 60).costSalesAmount).toBeCloseTo(20 * 60);
      }
      expect(calculateCost('0-50', 20, 0, 60).commissionRate).toBe(60);
      expect(calculateCost('0-50', 20, 0, 'abc').costSalesAmount).toBe(0);
    });

    it('a partner commission raises the quote', () => {
      expect(calculateCost('0-50', 20, 0, 53.5).finalAmount).toBeGreaterThan(calculateCost('0-50', 20).finalAmount);
    });

    // Flipped in Phase 7 6.6 (finding 1): Profit / SQ is gross profit per square foot.
    it('computes Profit / SQ as grossProfit / sqFt', () => {
      const sqFt = 10;
      const res = calculateCost('0-50', sqFt, 15, 53.5);
      expect(res.internalCostPerSq).toBeCloseTo(res.grossProfit / sqFt);
    });

    it('derives gross profit as final amount less internal manufacturing and commission cost', () => {
      const sqFt = 10;
      const t = pricingTiers['0-50'];
      const res = calculateCost('0-50', sqFt, 0, 53.5);
      expect(res.internalManufAmount).toBeCloseTo(sqFt * t.internalManufRate);
      expect(res.totalCostOfSales).toBeCloseTo(res.internalManufAmount + sqFt * 53.5);
      expect(res.grossProfit).toBeCloseTo(res.finalAmount - res.totalCostOfSales);
    });
  });
});
