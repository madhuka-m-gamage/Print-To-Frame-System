import React, { useState, useEffect, useMemo } from "react";
import {
  Calculator,
  Layers,
  Ruler,
  TrendingUp,
  Factory,
  Truck,
  Info,
  DollarSign,
  Shield,
  ChevronRight,
  CircleCheckBig,
} from "lucide-react";
import { pricingTiers, calculateCost, determineTier } from "../../services/pricingEngine";
import { PageHeader } from "../common/ui";

const ct = (val) => {
  if (val === undefined || val === null) return "—";
  return (
    "Rs. " +
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val)
  );
};

const MetricLabel = ({ children }) => (
  <span className="block text-[9px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-0.5">
    {children}
  </span>
);

const BreakdownRow = ({
  label,
  unit,
  rate,
  amount,
  isTotal,
  isHighlight,
  isDeduction,
  icon: Icon,
}) => (
  <tr
    className={`border-b border-outline-variant/50 transition-colors ${isTotal ? "bg-surface-container-low" : ""} ${
      isHighlight ? "bg-primary/10" : ""
    }`}
  >
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={13} className="text-on-surface-variant shrink-0" />}
        <span className={`text-[11px] font-bold ${isTotal || isHighlight ? "text-on-surface" : "text-on-surface"}`}>
          {label}
        </span>
      </div>
    </td>
    <td className="px-3 py-3 text-right">
      {unit && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-surface-container-highest text-on-surface">
          {unit}
        </span>
      )}
    </td>
    <td className="px-3 py-3 text-right text-[10px] font-mono font-bold text-on-surface-variant">
      {rate !== undefined ? (typeof rate === "number" ? rate.toFixed(1) : rate) : "—"}
    </td>
    <td
      className={`px-4 py-3 text-right font-mono text-xs font-black
      ${isDeduction ? "text-error" : isHighlight ? "text-primary" : isTotal ? "text-on-surface" : "text-on-surface"}`}
    >
      {isDeduction ? "− " : ""}
      {amount}
    </td>
  </tr>
);

const TableHeader = () => (
  <thead className="bg-surface-container">
    <tr>
      {["Description", "Type", "Rate", "Total"].map((text, idx) => (
        <th
          key={text}
          className={`px-4 py-2.5 text-[9px] font-black text-on-surface-variant uppercase tracking-widest ${
            idx > 0 ? "text-right" : ""
          }`}
        >
          {text}
        </th>
      ))}
    </tr>
  </thead>
);

const CostCalculator = () => {
  const [length, setLength] = useState(10);
  const [height, setHeight] = useState(5);
  const [sqFt, setSqFt] = useState(50);
  const [activeTier, setActiveTier] = useState("0-50");

  useEffect(() => {
    const area = Math.max(0, length * height);
    setSqFt(area);
    if (area > 0) {
      const tier = determineTier(area);
      setActiveTier(tier);
    }
  }, [length, height]);

  const pricing = useMemo(() => {
    if (sqFt <= 0) return {};
    return calculateCost(activeTier, sqFt) || {};
  }, [activeTier, sqFt]);

  const tierInfo = pricingTiers[activeTier] || {};

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col pb-8">
      <PageHeader
        title="Cost Calculator"
        subtitle="Algorithmic steel framing pricing, BOM estimation, QA, and margin calculator."
        metrics={[
          { label: "Active Tier", value: tierInfo.range || "—", color: "cyan" },
          { label: "Base Rate / SqFt", value: `Rs. ${(tierInfo.rate || 0).toLocaleString()}`, color: "emerald" },
          { label: "Calculated Area", value: `${sqFt} SqFt`, color: "purple" }
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Job Config Card */}
        <div className="lg:col-span-8 bg-surface-container rounded-2xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-primary text-on-primary rounded-xl">
              <Ruler size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-on-surface text-sm uppercase tracking-tight">
                Job Configuration
              </h3>
              <p className="text-[11px] text-on-surface-variant font-semibold">
                Enter dimensions to auto-calculate square footage
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="calc-length" className="block text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                Length (ft)
              </label>
              <input
                id="calc-length"
                type="number"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="w-full border-2 border-outline-variant rounded-xl p-3 text-sm font-bold text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary transition-all bg-surface-container-low"
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label htmlFor="calc-height" className="block text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                Height (ft)
              </label>
              <input
                id="calc-height"
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full border-2 border-outline-variant rounded-xl p-3 text-sm font-bold text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary transition-all bg-surface-container-low"
                placeholder="0"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Calculated Area Card */}
        <div className="lg:col-span-4 bg-surface-container-highest rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group shadow-[0_8px_30px_rgba(0,218,243,0.15)]" aria-live="polite">
          <div className="absolute top-0 right-0 p-6 text-on-surface/5 group-hover:text-primary/10 transition-colors" aria-hidden="true">
            <TrendingUp size={110} />
          </div>
          <div className="relative z-10">
            <span className="inline-block px-2 py-0.5 bg-primary text-on-primary rounded-md text-[9px] font-black uppercase tracking-widest mb-4">
              Calculated Area
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold text-indigo-400 tracking-tighter">
                {sqFt}
              </span>
              <span className="text-on-surface font-black text-sm">SQ FT</span>
            </div>
          </div>
          <div className="relative z-10 mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
              Auto Tier
            </span>
            <span className="px-3 py-1 bg-primary text-on-primary rounded-full text-[10px] font-bold">
              {tierInfo.range || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Manual Tier Select (Overrides) */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex bg-surface-container-high/80 p-1.5 rounded-2xl w-full sm:w-auto gap-1 overflow-x-auto custom-scrollbar">
            {Object.keys(pricingTiers).map((tierKey) => (
              <button
                key={tierKey}
                onClick={() => setActiveTier(tierKey)}
                className={`px-5 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider whitespace-nowrap transition-all duration-200 ${
                  activeTier === tierKey
                    ? "bg-surface-container text-primary shadow-[0_4px_25px_rgba(0,218,243,0.1)]"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50"
                }`}
              >
                {tierKey}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant shrink-0">
            <Info size={13} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Auto-switches on SQ change
            </span>
          </div>
        </div>
      </div>

      {sqFt > 0 && pricing.finalAmount !== undefined ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client Quotation Breakdown */}
          <div className="bg-surface-container rounded-2xl border border-outline-variant border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
            <div className="p-6 pb-4 border-b border-outline-variant/50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary text-on-primary rounded-xl">
                    <Calculator size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-on-surface text-sm uppercase tracking-tight">
                      Client Quotation
                    </h3>
                    <p className="text-[11px] text-on-surface-variant font-semibold">
                      Official breakdown for customer
                    </p>
                  </div>
                </div>
                <div className="bg-primary/10 p-3 rounded-xl border border-primary/20 text-right shrink-0">
                  <MetricLabel>Net Rate / SQ</MetricLabel>
                  <span className="font-mono font-extrabold text-primary text-base">
                    {ct(pricing.finalAmountPerSq)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full min-w-[440px]">
                <TableHeader />
                <tbody>
                  <BreakdownRow
                    label="Core Manufacturing"
                    unit="SQFT"
                    rate={tierInfo.manufRate}
                    amount={ct(pricing.manufAmount)}
                    icon={Factory}
                  />
                  <BreakdownRow
                    label="Logistics & Handling"
                    unit="FIXED"
                    rate={tierInfo.logistics}
                    amount={ct(pricing.logistics)}
                    icon={Truck}
                  />
                  <BreakdownRow
                    label="Quality Assurance"
                    unit="FIXED"
                    rate={tierInfo.qa}
                    amount={ct(pricing.qa)}
                    icon={CircleCheckBig}
                  />
                  <BreakdownRow
                    label="Sales Commission"
                    unit="SQFT"
                    rate={tierInfo.costSalesRate}
                    amount={ct(pricing.costSalesAmount)}
                    icon={DollarSign}
                  />
                  <BreakdownRow
                    label="Margin & Overhead"
                    unit="%"
                    rate={`${(tierInfo.profitMargin * 100).toFixed(1)}%`}
                    amount={ct(pricing.profitAndOH)}
                    icon={TrendingUp}
                    isHighlight={true}
                  />
                  <BreakdownRow
                    label="Gross Estimate"
                    isTotal={true}
                    amount={ct(pricing.totalCost)}
                  />
                  <BreakdownRow
                    label="Agent Discount (15%)"
                    isDeduction={true}
                    amount={ct(pricing.discount)}
                  />
                </tbody>
              </table>
            </div>
            <div className="bg-surface-container-highest p-5 flex justify-between items-center mt-auto border-t border-outline-variant/40">
              <div>
                <MetricLabel>
                  <span className="text-primary">Final Total</span>
                </MetricLabel>
                <span className="text-xs text-on-surface-variant font-semibold uppercase">
                  Net payable by client
                </span>
              </div>
              <span className="text-2xl font-mono font-extrabold text-on-surface">
                {ct(pricing.finalAmount)}
              </span>
            </div>
          </div>

          {/* Internal Profit Analysis */}
          <div className="flex flex-col gap-4">
            <div className="bg-surface-container rounded-2xl border border-outline-variant border-t-4 border-t-secondary shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              <div className="p-6 pb-4 border-b border-outline-variant/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-secondary text-on-secondary rounded-xl">
                      <Shield size={16} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-on-surface text-sm uppercase tracking-tight">
                        Profit Analysis
                      </h3>
                      <p className="text-[11px] text-on-surface-variant font-semibold">
                        Internal performance — confidential
                      </p>
                    </div>
                  </div>
                  <div className="bg-secondary/10 p-3 rounded-xl border border-emerald-100 text-right shrink-0">
                    <MetricLabel>Profit / SQ</MetricLabel>
                    <span className="font-mono font-extrabold text-emerald-400 text-base">
                      {ct(pricing.internalCostPerSq)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full min-w-[440px]">
                  <thead className="bg-surface-container">
                    <tr>
                      {["Component", "Type", "Rate", "Amount"].map((text, idx) => (
                        <th
                          key={text}
                          className={`px-4 py-2.5 text-[9px] font-black text-on-surface-variant uppercase tracking-widest ${
                            idx > 0 ? "text-right" : ""
                          }`}
                        >
                          {text}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <BreakdownRow
                      label="Internal Cost (Mfg)"
                      unit="SQFT"
                      rate={tierInfo.internalManufRate}
                      amount={ct(pricing.internalManufAmount)}
                      icon={Factory}
                    />
                    <BreakdownRow
                      label="Sales Commission"
                      unit="SQFT"
                      rate={tierInfo.costSalesRate}
                      amount={ct(pricing.costSalesAmount)}
                      icon={DollarSign}
                    />
                    <tr className="border-b border-outline-variant/50">
                      <td colSpan={4} className="py-5 px-4 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-container-low rounded-full border border-outline-variant text-[9px] font-black text-on-surface-variant uppercase tracking-widest">
                          <ChevronRight size={10} /> Internal Performance Boundary
                        </div>
                      </td>
                    </tr>
                    <BreakdownRow
                      label="Total COGS"
                      isTotal={true}
                      amount={ct(pricing.totalCostOfSales)}
                      icon={ChevronRight}
                    />
                  </tbody>
                </table>
              </div>
              <div className="bg-emerald-700 p-5 flex justify-between items-center mt-auto relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 -rotate-12 group-hover:rotate-0 transition-transform duration-500">
                  <TrendingUp size={70} color="white" />
                </div>
                <div className="relative z-10">
                  <MetricLabel>
                    <span className="text-emerald-200">Gross Margin</span>
                  </MetricLabel>
                  <span className="text-xs text-emerald-200 font-semibold uppercase">
                    Revenue − COGS
                  </span>
                </div>
                <span className="text-2xl font-mono font-extrabold text-on-surface relative z-10">
                  {ct(pricing.grossProfit)}
                </span>
              </div>
            </div>

            {/* Explanatory Info Card */}
            <div className="bg-primary/10 rounded-2xl border border-primary/30 p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-2 bg-primary/100 text-on-surface rounded-xl shrink-0">
                <Info size={15} />
              </div>
              <div>
                <h4 className="text-[11px] font-extrabold text-yellow-500 uppercase tracking-wider mb-1">
                  Calculation Method
                </h4>
                <p className="text-[10px] text-yellow-500 font-semibold leading-relaxed">
                  A 15% agent discount is applied to the gross estimate. Fixed costs (Logistics + QA) are
                  included before the profit margin is applied.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 bg-surface-container rounded-2xl border border-dashed border-outline-variant text-on-surface-variant">
          <div className="text-center">
            <Calculator size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-bold">
              Enter dimensions above to generate pricing
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostCalculator;
