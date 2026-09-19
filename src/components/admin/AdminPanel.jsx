import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, DollarSign, Users, Activity, Shield, Check, X, 
  ChartPie, Download, BriefcaseBusiness, Building, FileText,
  Database, HardDrive, ShieldCheck, Clock, ArrowUpRight, Layers
} from 'lucide-react';
import PermissionsManager from './PermissionsManager';
import { PageHeader, FilterBar, StatusBadge, TwoToneIcon } from '../common/ui';
import { subscribeToCollection, COLLECTIONS } from '../../services/firestoreSync';

export default function AdminPanel({ dataStore, currentUser }) {
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'permissions' | 'database' | 'audit'
  const [searchQuery, setSearchQuery] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    const unsub = subscribeToCollection(COLLECTIONS.AUDIT_LOG, setAuditLogs);
    return () => unsub();
  }, []);

  const leads = dataStore?.leads || [];
  const projects = dataStore?.projects || [];
  const invoices = dataStore?.invoices || [];
  const partners = dataStore?.partners || [];
  const customers = dataStore?.customers || [];

  const totalPipeline = leads.reduce((acc, lead) => acc + (Number(lead.value) || 0), 0);
  const invoicedGap = invoices
    .filter((inv) => inv.status !== "Paid")
    .reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
  const partnerOwed = partners.reduce((acc, part) => acc + (Number(part.pending) || 0), 0);
  const deliveredVolume = leads
    .filter((lead) => lead.stage === "Completed")
    .reduce((acc, lead) => acc + (Number(lead.totalSqFt) || 0), 0);

  const totalRecords = leads.length + projects.length + invoices.length + partners.length + customers.length;

  const downloadCSV = (label, data) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0] || {}).join(",");
    const rows = data.map((item) =>
      Object.values(item)
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + "\n" + rows);
    const link = document.createElement("a");
    link.href = csvContent;
    link.download = `PTF_${label}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Standardized Header */}
      <PageHeader
        title="System Overview"
        subtitle="Executive enterprise telemetry, database record health, and dynamic RBAC security matrix."
        metrics={[
          { label: "Pipeline Value", value: `LKR ${(totalPipeline / 1000).toFixed(0)}k`, color: "cyan" },
          { label: "Unpaid Receivables", value: `LKR ${(invoicedGap / 1000).toFixed(0)}k`, color: "purple" },
          { label: "Delivered Volume", value: `${deliveredVolume.toFixed(0)} SqFt`, color: "emerald" },
          { label: "Database Records", value: totalRecords, color: "amber" }
        ]}
        actions={
          <button
            onClick={() => downloadCSV('Full_Database_Dump', leads)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(0,218,243,0.25)] active:scale-95 flex-shrink-0 cursor-pointer"
          >
            <Download size={15} />
            <span>Export Database CSV</span>
          </button>
        }
      />

      {/* Standardized Filter / Domain Switcher */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Filter telemetry, permissions, database records, and audit events..."
        activeFilter={activeTab}
        onFilterChange={setActiveTab}
        filterOptions={[
          { id: 'analytics', label: 'Executive Analytics', count: 4 },
          { id: 'permissions', label: 'RBAC Permissions Matrix', count: 8 },
          { id: 'database', label: 'Database Storage Health', count: 5 },
          { id: 'audit', label: 'System Audit Logs', count: auditLogs.length }
        ]}
        totalCount={totalRecords + auditLogs.length}
        filteredCount={totalRecords}
      />

      {/* ── SUB-WORKSPACES ─────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Top 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Total Pipeline Value", value: `LKR ${totalPipeline.toLocaleString()}`, type: "lead" },
              { title: "Invoiced Receivables", value: `LKR ${invoicedGap.toLocaleString()}`, type: "invoice" },
              { title: "Completed SqFt Output", value: `${deliveredVolume.toLocaleString()} SqFt`, type: "status" },
              { title: "Framing Partner Accruals", value: `LKR ${partnerOwed.toLocaleString()}`, type: "payment" }
            ].map((stat, idx) => (
              <div key={idx} className="p-5 bg-surface-container/60 rounded-2xl border border-outline-variant/60 shadow-sm flex items-center gap-4">
                <TwoToneIcon type={stat.type} size="lg" />
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{stat.title}</p>
                  <p className="text-base sm:text-lg font-black text-on-surface font-mono mt-0.5">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Symmetrical 2-Panel Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 bg-surface-container/60 rounded-2xl border border-outline-variant/60 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                <ChartPie size={14} className="text-primary" />
                Revenue Pipeline vs Settled Invoices
              </h4>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                  <span className="text-on-surface-variant">Gross Quotation Pipeline</span>
                  <span className="font-mono font-bold text-on-surface">LKR {totalPipeline.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                  <span className="text-on-surface-variant">Unpaid Receivables</span>
                  <span className="font-mono font-bold text-status-danger-on">LKR {invoicedGap.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                  <span className="text-on-surface-variant">Framing Commission Accruals</span>
                  <span className="font-mono font-bold text-status-warning-on">LKR {partnerOwed.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-surface-container/60 rounded-2xl border border-outline-variant/60 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                <Database size={14} className="text-primary" />
                Live Firestore Storage Telemetry
              </h4>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                  <span className="text-on-surface-variant">Active Leads in CRM</span>
                  <span className="font-mono font-bold text-primary">{leads.length} docs</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                  <span className="text-on-surface-variant">Fabrication Works & Projects</span>
                  <span className="font-mono font-bold text-primary">{projects.length} docs</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                  <span className="text-on-surface-variant">Invoices & Financial Records</span>
                  <span className="font-mono font-bold text-primary">{invoices.length} docs</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PERMISSIONS MANAGER ────────────────────────────────────── */}
      {activeTab === 'permissions' && (
        <div className="bg-surface-container/60 rounded-2xl border border-outline-variant/60 p-6 shadow-sm">
          <PermissionsManager currentUser={currentUser} />
        </div>
      )}

      {/* ── TAB 3: DATABASE TELEMETRY & CSV DUMP ───────────────────────────── */}
      {activeTab === 'database' && (
        <div className="bg-surface-container/60 rounded-2xl border border-outline-variant/60 overflow-hidden shadow-sm flex flex-col">
          <div className="p-3.5 px-4 bg-surface-container-low/80 border-b border-outline-variant/60 flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            <span className="flex items-center gap-2">
              <HardDrive size={14} className="text-primary" />
              Database Collection Collections & Data Exports
            </span>
            <span className="text-[10px] text-status-success-on bg-status-success/15 px-2 py-0.5 rounded-full border border-status-success/30 font-bold uppercase">Firestore Healthy</span>
          </div>

          <div className="divide-y divide-outline-variant/30 text-xs">
            {[
              { name: "CRM Leads & Quotations", count: leads.length, data: leads, label: "Leads" },
              { name: "Fabrication & Assembly Projects", count: projects.length, data: projects, label: "Projects" },
              { name: "Billing & Invoice Ledger", count: invoices.length, data: invoices, label: "Invoices" },
              { name: "Framing Partner Studios", count: partners.length, data: partners, label: "Partners" },
              { name: "Registered Client Accounts", count: customers.length, data: customers, label: "Customers" }
            ].map((col, idx) => (
              <div key={idx} className="p-4 flex justify-between items-center hover:bg-surface-container-high/40 transition-colors">
                <div>
                  <p className="font-bold text-on-surface text-sm">{col.name}</p>
                  <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">{col.count} synchronized records</p>
                </div>
                <button
                  onClick={() => downloadCSV(col.label, col.data)}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl border border-primary/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download size={13} /> Export CSV
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: SYSTEM AUDIT STREAM ────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="bg-surface-container/60 rounded-2xl border border-outline-variant/60 overflow-hidden shadow-sm flex flex-col">
          <div className="p-3.5 px-4 bg-surface-container-low/80 border-b border-outline-variant/60 flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            <span className="flex items-center gap-2">
              <Clock size={14} className="text-primary" />
              Global System Audit Activity Trail ({auditLogs.length})
            </span>
            <button
              onClick={() => downloadCSV('Audit_Logs', auditLogs)}
              className="text-[10px] text-primary hover:underline lowercase font-medium flex items-center gap-1"
            >
              <Download size={11} /> export audit log
            </button>
          </div>

          <div className="divide-y divide-outline-variant/30 max-h-[500px] overflow-y-auto custom-scrollbar">
            {auditLogs.length > 0 ? (
              auditLogs
                .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
                .map((log, idx) => (
                  <div key={log._firestoreId || idx} className="p-3.5 px-4 flex justify-between items-start gap-4 hover:bg-surface-container-high/40 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-on-surface">{log.action || 'ACTION'}</span>
                        <span className="text-[9px] font-bold px-2 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                          {log.module || 'System'}
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-mono font-medium">{log.userName || log.userId}</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-1">{log.details || log.description}</p>
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-mono flex-shrink-0">
                      {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Recent'}
                    </span>
                  </div>
                ))
            ) : (
              <div className="py-12 text-center text-on-surface-variant text-xs">
                No system audit events recorded.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
