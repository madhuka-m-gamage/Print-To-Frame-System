import React, { useState, useMemo, useEffect } from "react";
import {
  LayoutDashboard, DollarSign, Target, Kanban, Hammer, Truck, TrendingUp,
  CircleCheckBig, ArrowRight, CircleAlert, User, Calculator, MessageSquare,
  Users, Sparkles, Loader, Search, Check, ClipboardCheck, Play, Wrench,
  Handshake, Cpu, FileText, Inbox, Clock, Navigation, Package, AlertTriangle,
  ArrowUpRight, Phone, Building, ChevronRight, ShieldCheck, Layers, BarChart3,
  PhoneCall, RefreshCw, Calendar, Eye
} from "lucide-react";
import { generateText } from "../../services/gemini";
import { toast } from "../../utils/toast";
import { subscribeToCollection, COLLECTIONS } from "../../services/firestoreSync";
import { PageHeader, FilterBar, StatusBadge, UserAvatar } from "../common/ui";

export const resolveDashboardDomain = (role) => {
  if (!role) return 'crm';
  const r = String(role).toLowerCase().trim();
  
  if (r.includes('admin') || r.includes('director') || r.includes('super') || r === 'manager' || r === 'operations manager') {
    return 'all';
  }
  if (r.includes('operation') || r.includes('logistics') || r.includes('fabricat') || r.includes('workshop') || r.includes('partner')) {
    return 'operations';
  }
  if (r.includes('account') || r.includes('billing') || r.includes('finance') || r.includes('audit')) {
    return 'finance';
  }
  return 'crm';
};

const LEAD_STAGES = ["Intake", "Processed", "75% Invoice Submited", "Recived"];
const DEAL_STAGES = ["Waiting", "Fabricating", "Ready To Load", "Hand Over", "Completed"];

const PipelineBar = ({ title, stages, data, getStageColor, onStageClick }) => {
  return (
    <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/60 shadow-sm space-y-2.5">
      <div className="flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-wider">
        <span>{title}</span>
        <span className="text-[10px] text-primary font-mono lowercase">click to inspect</span>
      </div>
      <div className="flex items-center gap-1.5" role="group" aria-label={`${title} progression`}>
        {stages.map((stage) => {
          const count = data.filter((item) => (item.stage || item.status) === stage).length;
          return (
            <button
              key={stage}
              type="button"
              className={`flex-1 py-2 px-1.5 rounded-xl text-center cursor-pointer transition-all hover:opacity-90 hover:scale-[1.02] border border-outline/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${getStageColor(
                stage
              )}`}
              title={`${stage}: ${count} item${count !== 1 ? "s" : ""}`}
              aria-label={`${stage}: ${count} item${count !== 1 ? "s" : ""}, click to view`}
              onClick={onStageClick}
            >
              <div className="text-base font-extrabold leading-none">{count}</div>
              <div className="text-[8px] uppercase font-bold tracking-wider opacity-85 truncate mt-1 leading-none">
                {stage}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function Dashboard({
  currentUser,
  setActiveTab,
  projects = [],
  logisticsJobs = [],
  customers = [],
  partners = [],
  leads = [],
  invoices = [],
  setLeads,
  setProjects,
  setLogisticsJobs,
}) {
  const resolvedDomain = resolveDashboardDomain(currentUser?.role);
  const isAdmin = resolvedDomain === 'all';

  const [activeCategory, setActiveCategory] = useState(resolvedDomain);
  const [searchQuery, setSearchQuery] = useState('');
  const [insight, setInsight] = useState("Focus on high-tension gallery wraps for upcoming digital art deadlines.");
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    if (currentUser?.role) {
      setActiveCategory(resolveDashboardDomain(currentUser.role));
    }
  }, [currentUser?.role]);

  useEffect(() => {
    if (isAdmin) {
      const unsub = subscribeToCollection(COLLECTIONS.AUDIT_LOG, setAuditLogs);
      return () => unsub();
    }
  }, [isAdmin]);

  // ── Metrics Calculations ──────────────────────────────────────────────────
  const activeLeads = useMemo(() => leads.filter(l => !l.isDeal && l.stage !== "Completed"), [leads]);
  const activeDeals = useMemo(() => leads.filter(l => l.isDeal && l.stage !== "Completed"), [leads]);
  const ongoingProjects = useMemo(() => projects.filter(p => p.status === "Ongoing"), [projects]);
  const pendingLogistics = useMemo(() => logisticsJobs.filter(j => j.status === "Pending"), [logisticsJobs]);

  const pendingRevenue = useMemo(() => {
    return leads
      .filter((lead) => lead.isDeal && lead.stage !== "Completed")
      .reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);
  }, [leads]);

  // Priority Action Work Queues (Filtered by search query)
  const crmActionQueue = useMemo(() => {
    return leads
      .filter(l => !l.isDeal && ["Intake", "Processed", "75% Invoice Submited"].includes(l.stage))
      .filter(l => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return l.name?.toLowerCase().includes(q) || l.phone?.toLowerCase().includes(q) || l.company?.toLowerCase().includes(q);
      })
      .slice(0, 5);
  }, [leads, searchQuery]);

  const dealsActionQueue = useMemo(() => {
    return leads
      .filter(l => l.isDeal && ["Waiting", "Fabricating", "Ready To Load"].includes(l.stage))
      .filter(l => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return l.name?.toLowerCase().includes(q) || l.phone?.toLowerCase().includes(q) || l.company?.toLowerCase().includes(q);
      })
      .slice(0, 5);
  }, [leads, searchQuery]);

  const opsActionQueue = useMemo(() => {
    return projects
      .filter(p => ["Pending", "Ongoing", "Ready For Inspection"].includes(p.status))
      .filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return p.title?.toLowerCase().includes(q) || p.jobNo?.toLowerCase().includes(q) || p.client?.toLowerCase().includes(q);
      })
      .slice(0, 5);
  }, [projects, searchQuery]);

  const financeActionQueue = useMemo(() => {
    return invoices
      .filter(inv => inv.status !== 'Paid')
      .filter(inv => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return inv.customerName?.toLowerCase().includes(q) || inv.id?.toLowerCase().includes(q) || inv.company?.toLowerCase().includes(q);
      })
      .slice(0, 5);
  }, [invoices, searchQuery]);

  // Receivables Aging Exposure
  const invoiceAging = useMemo(() => {
    const buckets = {
      current: { label: "0–30d", count: 0, amount: 0 },
      thirtyToSixty: { label: "31–60d", count: 0, amount: 0 },
      sixtyToNinety: { label: "61–90d", count: 0, amount: 0 },
      overNinety: { label: "90d+ Overdue", count: 0, amount: 0 },
    };
    const now = Date.now();
    (invoices || []).filter(inv => inv.status !== 'Paid').forEach(inv => {
      const invDate = new Date(inv.date || now).getTime();
      const ageDays = Math.max(0, Math.floor((now - invDate) / 86400000));
      const amt = Number(inv.amount || 0);
      if (ageDays <= 30) {
        buckets.current.count++;
        buckets.current.amount += amt;
      } else if (ageDays <= 60) {
        buckets.thirtyToSixty.count++;
        buckets.thirtyToSixty.amount += amt;
      } else if (ageDays <= 90) {
        buckets.sixtyToNinety.count++;
        buckets.sixtyToNinety.amount += amt;
      } else {
        buckets.overNinety.count++;
        buckets.overNinety.amount += amt;
      }
    });
    return buckets;
  }, [invoices]);

  const fetchAIInsight = async () => {
    setLoadingInsight(true);
    try {
      const prompt = `Print To Frame — Sri Lanka specialty steel gallery framing. Stats: Active Leads: ${activeLeads.length}, Active Deals (pipeline): ${activeDeals.length}, Fabrication Jobs: ${ongoingProjects.length}, Pending Logistics: ${pendingLogistics.length}, Pending Revenue: LKR ${pendingRevenue.toLocaleString()}, Customers: ${customers.length}. Provide one concise, strategic business recommendation (max 2 sentences).`;
      const aiResponse = await generateText(prompt);
      setInsight(aiResponse);
      toast.success("AI Strategic Recommendation updated!");
    } catch (error) {
      console.error(error);
      setInsight("Focus on high-tension gallery wraps for upcoming digital art deadlines.");
    } finally {
      setLoadingInsight(false);
    }
  };

  const getSubtitle = () => {
    switch (activeCategory) {
      case 'crm':
        return 'CRM & Sales Command Center — Real-time intake pipeline, quotation volume, and lead status.';
      case 'operations':
        return 'Production & Logistics Command Center — Work orders, cutting schedules, and dispatch status.';
      case 'finance':
        return 'Finance & Accounts Command Center — Receivables aging, revenue performance, and billing status.';
      default:
        return 'Executive Overview — Real-time enterprise overview, project metrics, and financial performance.';
    }
  };

  const getLeadStageColor = (stage) => {
    switch (stage) {
      case "Intake": return "bg-primary/20 text-primary";
      case "Processed": return "bg-sky-500/20 text-sky-400";
      case "75% Invoice Submited": return "bg-amber-500/20 text-amber-400";
      case "Recived": return "bg-emerald-500/20 text-emerald-400";
      default: return "bg-surface-container text-on-surface-variant";
    }
  };

  const getDealStageColor = (stage) => {
    switch (stage) {
      case "Waiting": return "bg-sky-500/20 text-sky-400";
      case "Fabricating": return "bg-amber-500/20 text-amber-400";
      case "Ready To Load": return "bg-primary/20 text-primary";
      case "Hand Over": return "bg-purple-500/20 text-purple-400";
      case "Completed": return "bg-emerald-500/20 text-emerald-400";
      default: return "bg-surface-container text-on-surface-variant";
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── 1. Standardized Header matching all modules ────────────────────── */}
      <PageHeader
        title="Dashboard"
        subtitle={getSubtitle()}
        metrics={[
          { label: "Active Leads", value: activeLeads.length, color: "cyan" },
          { label: "Pipeline Deals", value: activeDeals.length, color: "emerald" },
          { label: "Ongoing Fab", value: ongoingProjects.length, color: "purple" },
          { label: "Pending Logistics", value: pendingLogistics.length, color: "amber" },
          { label: "Pipeline Value", value: `LKR ${(pendingRevenue / 1000).toFixed(0)}k`, color: "cyan" }
        ]}
        actions={
          <button
            onClick={fetchAIInsight}
            disabled={loadingInsight}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(0,218,243,0.25)] active:scale-95 flex-shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Sparkles size={15} className={loadingInsight ? 'animate-spin' : ''} />
            <span>{loadingInsight ? 'Consulting Gemini...' : 'Generate AI Advisory'}</span>
          </button>
        }
      />

      {/* ── 2. Standardized Filter & Domain Bar ────────────────────────────── */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search work orders across leads, deals, fabrication jobs, and invoices..."
        activeFilter={activeCategory}
        onFilterChange={setActiveCategory}
        filterOptions={[
          { id: 'all', label: 'All Operations', count: activeLeads.length + activeDeals.length + ongoingProjects.length },
          { id: 'crm', label: 'CRM & Sales', count: activeLeads.length + activeDeals.length },
          { id: 'operations', label: 'Production & Logistics', count: ongoingProjects.length + pendingLogistics.length },
          { id: 'finance', label: 'Finance & Billing', count: invoices.filter(i => i.status !== 'Paid').length }
        ]}
        totalCount={leads.length + projects.length + invoices.length}
        filteredCount={crmActionQueue.length + dealsActionQueue.length + opsActionQueue.length + financeActionQueue.length}
      />

      {/* ── 3. Main Symmetrical 2-Column Responsive Layout ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: Pipeline Visualizers & Telemetry ─────────────────── */}
        <div className="space-y-6">
          
          {/* AI Strategic Advisory Card */}
          <div className="p-5 bg-surface-container/80 rounded-2xl border border-primary/40 shadow-[0_4px_25px_rgba(0,218,243,0.08)] relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/20 text-primary rounded-lg">
                  <Sparkles size={15} />
                </div>
                <h3 className="text-xs font-black text-on-surface uppercase tracking-wider">
                  AI Strategic Operational Advisory
                </h3>
              </div>
              <span className="text-[9px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                Gemini 2.5 Live
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed font-medium mt-2">
              {insight}
            </p>
          </div>

          {/* Lead Pipeline Progression */}
          {(activeCategory === 'all' || activeCategory === 'crm') && (
            <PipelineBar
              title="CRM Lead Intake Pipeline"
              stages={LEAD_STAGES}
              data={leads.filter(l => !l.isDeal)}
              getStageColor={getLeadStageColor}
              onStageClick={() => setActiveTab && setActiveTab('leads')}
            />
          )}

          {/* Deal Production Progression */}
          {(activeCategory === 'all' || activeCategory === 'crm' || activeCategory === 'operations') && (
            <PipelineBar
              title="Deals & Fabrication Lifecycle"
              stages={DEAL_STAGES}
              data={leads.filter(l => l.isDeal)}
              getStageColor={getDealStageColor}
              onStageClick={() => setActiveTab && setActiveTab('pipeline')}
            />
          )}

          {/* Receivables Aging Exposure Ledger */}
          {(activeCategory === 'all' || activeCategory === 'finance') && (
            <div className="p-5 bg-surface-container/60 rounded-2xl border border-outline-variant/60 shadow-sm space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-outline-variant/40">
                <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                  <DollarSign size={14} className="text-primary" />
                  Receivables Aging & Cash Flow Exposure
                </h4>
                <button
                  onClick={() => setActiveTab && setActiveTab('invoices')}
                  className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1"
                >
                  View Invoices <ArrowUpRight size={10} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: "0–30 Days", data: invoiceAging.current, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                  { label: "31–60 Days", data: invoiceAging.thirtyToSixty, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                  { label: "61–90 Days", data: invoiceAging.sixtyToNinety, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                  { label: "90d+ Overdue", data: invoiceAging.overNinety, color: "text-rose-400 bg-rose-500/10 border-rose-500/20" }
                ].map((bucket, idx) => (
                  <div key={idx} className={`p-3 rounded-xl border ${bucket.color} flex flex-col justify-between`}>
                    <span className="text-[9px] uppercase font-bold tracking-wider opacity-80">{bucket.label}</span>
                    <div className="mt-1.5">
                      <p className="text-xs font-black font-mono">
                        LKR {(bucket.data.amount / 1000).toFixed(1)}k
                      </p>
                      <p className="text-[9px] opacity-70 font-mono mt-0.5">{bucket.data.count} unpaid</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Actionable Priority Work Queues ────────────────── */}
        <div className="space-y-6">
          
          {/* CRM Leads Queue */}
          {(activeCategory === 'all' || activeCategory === 'crm') && (
            <div className="bg-surface-container/60 border border-outline-variant/60 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="p-3.5 px-4 bg-surface-container-low/80 border-b border-outline-variant/60 flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <Target size={14} className="text-primary" />
                  Priority CRM Intake Queue ({crmActionQueue.length})
                </span>
                <button onClick={() => setActiveTab && setActiveTab('leads')} className="text-[10px] text-primary hover:underline lowercase font-medium">
                  view all leads
                </button>
              </div>

              <div className="divide-y divide-outline-variant/30">
                {crmActionQueue.length > 0 ? (
                  crmActionQueue.map((lead) => (
                    <div key={lead.id} className="p-3.5 px-4 flex items-center justify-between gap-3 hover:bg-surface-container-high/40 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs text-on-surface truncate">{lead.name || 'Direct Lead'}</p>
                          <span className="text-[9px] font-bold px-2 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                            {lead.stage}
                          </span>
                        </div>
                        <p className="text-[10px] text-on-surface-variant font-mono truncate mt-0.5">
                          {lead.phone || 'No phone'} · Value: LKR {Number(lead.value || 0).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone.replace(/[^0-9+]/g, '')}`}
                            className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 border border-emerald-500/20 focus-visible:ring-2 focus-visible:ring-emerald-400"
                            title="Call Lead"
                            aria-label={`Call lead ${lead.name || lead.phone}`}
                          >
                            <PhoneCall size={12} aria-hidden="true" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveTab && setActiveTab('leads')}
                          aria-label={`Inspect lead ${lead.name || 'record'}`}
                          className="px-2.5 py-1 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[10px] font-bold rounded-lg border border-outline-variant focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-on-surface-variant">
                    No pending intake items matching search.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active Deals Queue */}
          {(activeCategory === 'all' || activeCategory === 'crm' || activeCategory === 'operations') && (
            <div className="bg-surface-container/60 border border-outline-variant/60 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="p-3.5 px-4 bg-surface-container-low/80 border-b border-outline-variant/60 flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <Kanban size={14} className="text-primary" aria-hidden="true" />
                  Deals in Fabrication & Assembly ({dealsActionQueue.length})
                </span>
                <button onClick={() => setActiveTab && setActiveTab('pipeline')} className="text-[10px] text-primary hover:underline lowercase font-medium">
                  view pipeline
                </button>
              </div>

              <div className="divide-y divide-outline-variant/30">
                {dealsActionQueue.length > 0 ? (
                  dealsActionQueue.map((deal) => (
                    <div key={deal.id} className="p-3.5 px-4 flex items-center justify-between gap-3 hover:bg-surface-container-high/40 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs text-on-surface truncate">{deal.name}</p>
                          <span className="text-[9px] font-bold px-2 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {deal.stage}
                          </span>
                        </div>
                        <p className="text-[10px] text-on-surface-variant font-mono truncate mt-0.5">
                          Value: LKR {Number(deal.value || 0).toLocaleString()} {deal.totalSqFt ? `· ${deal.totalSqFt} SqFt` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab && setActiveTab('pipeline')}
                        aria-label={`Advance stage for deal ${deal.name}`}
                        className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold rounded-lg border border-primary/30 focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Advance Stage
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-on-surface-variant">
                    No active deals matching search.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pending Invoices Action Queue */}
          {(activeCategory === 'all' || activeCategory === 'finance') && (
            <div className="bg-surface-container/60 border border-outline-variant/60 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="p-3.5 px-4 bg-surface-container-low/80 border-b border-outline-variant/60 flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <DollarSign size={14} className="text-primary" aria-hidden="true" />
                  Unpaid Invoice Receivables ({financeActionQueue.length})
                </span>
                <button onClick={() => setActiveTab && setActiveTab('invoices')} className="text-[10px] text-primary hover:underline lowercase font-medium">
                  open billing
                </button>
              </div>

              <div className="divide-y divide-outline-variant/30">
                {financeActionQueue.length > 0 ? (
                  financeActionQueue.map((inv) => (
                    <div key={inv.id || inv._firestoreId} className="p-3.5 px-4 flex items-center justify-between gap-3 hover:bg-surface-container-high/40 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs text-on-surface truncate">{inv.customerName || 'Direct Customer'}</p>
                          <span className="font-mono text-[9px] text-primary bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20">{inv.id}</span>
                        </div>
                        <p className="text-[10px] text-on-surface-variant font-mono truncate mt-0.5">
                          Amount: LKR {Number(inv.amount || 0).toLocaleString()} · Due: {inv.dueDate || 'Immediate'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab && setActiveTab('invoices')}
                        aria-label={`Inspect invoice ${inv.id} for ${inv.customerName || 'customer'}`}
                        className="px-2.5 py-1 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[10px] font-bold rounded-lg border border-outline-variant focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Inspect
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-on-surface-variant">
                    All receivables settled!
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
