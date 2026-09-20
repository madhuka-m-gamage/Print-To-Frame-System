export const pricingTiers = {
  "0-50": {
    range: "0–50 SQ",
    manufRate: 118.5,
    logistics: 2000,
    qa: 2000,
    profitMargin: 0.3997,
    internalManufRate: 40,
  },
  "50-70": {
    range: "50–70 SQ",
    manufRate: 118.5,
    logistics: 2000,
    qa: 2000,
    profitMargin: 0.4,
    internalManufRate: 40,
  },
  "70-100": {
    range: "70–100 SQ",
    manufRate: 118.5,
    logistics: 3000,
    qa: 4000,
    profitMargin: 0.3672,
    internalManufRate: 40,
  },
  "100-150": {
    range: "100–150 SQ",
    manufRate: 118.5,
    logistics: 3000,
    qa: 4000,
    profitMargin: 0.3793,
    internalManufRate: 40,
  },
  "150+": {
    range: "150+ SQ",
    manufRate: 118.5,
    logistics: 3000,
    qa: 4000,
    profitMargin: 0.3793,
    internalManufRate: 40,
  },
};

/**
 * Cost stack for a job.
 * @param {string} tier key of pricingTiers
 * @param {number} sqFt area in square feet
 * @param {number} [discountPct=0] optional discount off the gross estimate, in percent
 * @param {number} [commissionRate=0] sales commission in LKR per sq ft: 0 for a direct lead,
 *   the partner's own rate for a referral
 */
export function calculateCost(tier, sqFt, discountPct = 0, commissionRate = 0) {
  const o = pricingTiers[tier];
  if (!o || sqFt <= 0) return null;
  const rate = Number(commissionRate) || 0;
  const s = sqFt * o.manufRate;
  const r = o.logistics;
  const c = o.qa;
  const f = sqFt * rate;
  const m = s + r + c + f;
  const x = m * o.profitMargin;
  const h = m + x;
  const g = h * ((Number(discountPct) || 0) / 100);
  const w = h - g;
  const N = w / sqFt;
  const C = sqFt * o.internalManufRate;
  const T = f;
  const _ = C + T;
  const b = w - _;
  const q = b / sqFt;
  return {
    tierInfo: o,
    manufAmount: s,
    logistics: r,
    qa: c,
    costSalesAmount: f,
    profitAndOH: x,
    totalCost: h,
    discount: g,
    discountPct: Number(discountPct) || 0,
    commissionRate: rate,
    finalAmount: w,
    finalAmountPerSq: N,
    internalManufAmount: C,
    totalCostOfSales: _,
    internalCostPerSq: q,
    grossProfit: b,
  };
}

export function determineTier(sqFt) {
  if (sqFt <= 0) return "";
  if (sqFt <= 50) return "0-50";
  if (sqFt <= 70) return "50-70";
  if (sqFt <= 100) return "70-100";
  if (sqFt <= 150) return "100-150";
  return "150+";
}
