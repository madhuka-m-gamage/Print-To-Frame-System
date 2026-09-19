export const pricingTiers = {
  "0-50": {
    range: "0–50 SQ",
    manufRate: 118.5,
    logistics: 2000,
    qa: 2000,
    costSalesRate: 53.5,
    profitMargin: 0.3997,
    internalManufRate: 40,
  },
  "50-70": {
    range: "50–70 SQ",
    manufRate: 118.5,
    logistics: 2000,
    qa: 2000,
    costSalesRate: 53.5,
    profitMargin: 0.4,
    internalManufRate: 40,
  },
  "70-100": {
    range: "70–100 SQ",
    manufRate: 118.5,
    logistics: 3000,
    qa: 4000,
    costSalesRate: 53.5,
    profitMargin: 0.3672,
    internalManufRate: 40,
  },
  "100-150": {
    range: "100–150 SQ",
    manufRate: 118.5,
    logistics: 3000,
    qa: 4000,
    costSalesRate: 53.5,
    profitMargin: 0.3793,
    internalManufRate: 40,
  },
  "150+": {
    range: "150+ SQ",
    manufRate: 118.5,
    logistics: 3000,
    qa: 4000,
    costSalesRate: 53.5,
    profitMargin: 0.3793,
    internalManufRate: 40,
  },
};

export function calculateCost(tier, sqFt) {
  const o = pricingTiers[tier];
  if (!o || sqFt <= 0) return null;
  const s = sqFt * o.manufRate;
  const r = o.logistics;
  const c = o.qa;
  const f = sqFt * o.costSalesRate;
  const m = s + r + c + f;
  const x = m * o.profitMargin;
  const h = m + x;
  const g = h * 0.15;
  const w = h - g;
  const N = w / sqFt;
  const C = sqFt * o.internalManufRate;
  const T = sqFt * o.costSalesRate;
  const _ = C + T;
  const b = w - _;
  const q = (b + r + c + f) / sqFt;
  return {
    tierInfo: o,
    manufAmount: s,
    logistics: r,
    qa: c,
    costSalesAmount: f,
    profitAndOH: x,
    totalCost: h,
    discount: g,
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
