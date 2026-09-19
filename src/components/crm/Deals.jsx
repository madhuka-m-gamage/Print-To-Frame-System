import React, { useState, useMemo } from 'react';
import { 
  Plus, ArrowLeft, ArrowRight, Trash2, Calendar, User, DollarSign, 
  Check, LayoutGrid, List, Download, Truck 
} from 'lucide-react';
import { toast } from '../../utils/toast';
import DeleteModal from '../common/DeleteModal';
import LeadCardDetails from './LeadCardDetails';
import { PageHeader, FilterBar, KanbanColumn, KanbanCard, StatusBadge } from '../common/ui';
import SortableTable from '../common/ui/SortableTable';
import { addDocument, updateDocument, deleteDocument, COLLECTIONS, generateInvoiceId } from '../../services/firestoreSync';
import { exportToCsv } from '../../utils/csvExport';
import { matchesEntity } from '../../utils/entityUtils';

const DEALS_STAGES = ["Waiting", "Fabricating", "Ready To Load", "Hand Over", "Completed"];

const STAGE_COLORS = {
  "Waiting": "amber",
  "Fabricating": "primary",
  "Ready To Load": "cyan",
  "Hand Over": "purple",
  "Completed": "emerald"
};

function DealColumn({
  stage,
  items,
  onMove,
  onMoveBack,
  isFirstStage,
  isLastStage,
  onCardClick,
  onAddNew,
  isAdmin,
  onDelete,
  onCreateDelivery,
  logisticsJobs = [],
  movingDealIds
}) {
  return (
    <KanbanColumn
      title={stage}
      count={items.length}
      stageColor={STAGE_COLORS[stage] || "primary"}
      onAddNew={isFirstStage ? onAddNew : null}
      addNewText="New Deal"
    >
      {items.map((deal) => {
        const stageDate = deal.stageEnteredAt || deal.date;
        const daysInStage = stageDate ? Math.max(0, Math.floor((Date.now() - new Date(stageDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;
        const isStale = daysInStage >= 8;
        const isWarning = daysInStage >= 4 && daysInStage < 8;

        const badges = (
          <>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase border border-primary/20">
                {deal.source || 'Lead Conversion'}
              </span>
              <span 
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                  isStale 
                    ? 'text-rose-400 bg-rose-500/15 border-rose-500/30 font-extrabold' 
                    : isWarning 
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' 
                      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                }`}
                title={`In stage for ${daysInStage} day(s)`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-rose-400 animate-ping' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                {daysInStage}d{isStale ? ' (Stale)' : ''}
              </span>
            </div>
            <span className="text-[10px] text-on-surface-variant font-medium flex items-center">
              <Calendar size={10} className="mr-1 opacity-70" />
              {deal.date}
            </span>
          </>
        );

        const subtitle = (
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center text-xs text-on-surface-variant">
              <User size={12} className="mr-1.5 opacity-60" />
              {deal.name || 'Unnamed Contact'}
            </span>
            {deal.agentId && (
              <span className="text-[9px] font-bold text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant" title={`Assigned Agent: ${deal.agentId}`}>
                {deal.agentId}
              </span>
            )}
          </div>
        );

        const metrics = (
          <div className="flex items-center text-on-surface">
            <DollarSign size={14} className="mr-0.5 text-on-surface-variant" />
            <span className="text-xs font-bold font-mono">
              LKR {Number(deal.value || 0).toLocaleString()}
            </span>
          </div>
        );

        const customActions = (
          <>
            {(stage === "Ready To Load" || stage === "Hand Over") && (() => {
              const job = logisticsJobs ? logisticsJobs.find(j => matchesEntity(j, deal)) : null;
              if (job && job.status === "Completed") {
                return (
                  <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Delivery Completed">
                    <Check size={12} />
                    <span className="text-[10px] font-bold">Delivered</span>
                  </div>
                );
              }
              if (job && job.status === "In Transit") {
                return (
                  <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20" title="Delivery In Transit">
                    <Truck size={12} className="animate-pulse" />
                    <span className="text-[10px] font-bold">In Transit</span>
                  </div>
                );
              }
              if (job) {
                return (
                  <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Delivery Dispatched">
                    <Truck size={12} />
                    <span className="text-[10px] font-bold">Dispatched</span>
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onCreateDelivery) onCreateDelivery(deal);
                  }}
                  className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-on-primary transition-all border border-primary/20 flex items-center gap-1 text-[10px] font-bold"
                  title="Notify Logistics to Dispatch Delivery"
                >
                  <Truck size={12} />
                  <span>Deliver</span>
                </button>
              );
            })()}
          </>
        );

        return (
          <KanbanCard
            key={deal.id}
            id={deal.id}
            title={deal.company || deal.name || 'No Company'}
            subtitle={subtitle}
            badges={badges}
            metrics={metrics}
            onClick={() => onCardClick(deal)}
            onMoveBack={() => onMoveBack(deal.id)}
            onMoveForward={movingDealIds.has(deal.id) ? null : () => onMove(deal.id)}
            onDelete={() => onDelete(deal.id)}
            isAdmin={isAdmin}
            isFirstStage={isFirstStage}
            isLastStage={isLastStage}
            customActions={customActions}
            moveForwardIcon={stage === "Hand Over" ? <Check size={13} /> : <ArrowRight size={13} />}
            moveForwardTitle={stage === "Hand Over" ? "Complete Deal & Commission" : "Move to next stage"}
          />
        );
      })}
    </KanbanColumn>
  );
}

export default function Deals({
  leads,
  setLeads,
  currentUser,
  partners = [],
  setPartners,
  customers = [],
  setCustomers,
  quotations = [],
  logisticsJobs = [],
  setLogisticsJobs,
  invoices = [],
  onSaveInvoice,
  onMarkInvoicePaid,
  receipts = [],
  onGenerateReceipt
}) {
  const [activeDeal, setActiveDeal] = useState(null);
  const [deleteDealId, setDeleteDealId] = useState(null);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [selectedDealIds, setSelectedDealIds] = useState([]);
  const isAdmin = currentUser?.role === "Admin";

  const handleBulkStageChange = async (targetStage) => {
    if (!selectedDealIds.length) return;
    const now = new Date().toISOString();
    setLeads(prev => prev.map(d => selectedDealIds.includes(d.id) ? { ...d, stage: targetStage, stageEnteredAt: now } : d));
    try {
      await Promise.all(selectedDealIds.map(id => {
        const deal = leads.find(d => d.id === id);
        return updateDocument(COLLECTIONS.LEADS, deal?._firestoreId || id, { stage: targetStage, stageEnteredAt: now });
      }));
      toast.success(`Moved ${selectedDealIds.length} deals to "${targetStage}"`);
      setSelectedDealIds([]);
    } catch (err) {
      toast.error('Bulk update failed: ' + err.message);
    }
  };

  const handleBulkExportCsv = () => {
    const exportData = filteredDeals.filter(d => selectedDealIds.length === 0 || selectedDealIds.includes(d.id));
    const columns = [
      { key: 'id', label: 'Deal ID' },
      { key: 'name', label: 'Client Contact' },
      { key: 'company', label: 'Company' },
      { key: 'phone', label: 'Phone' },
      { key: 'stage', label: 'Current Stage' },
      { key: 'value', label: 'Committed Value (LKR)' },
      { key: 'date', label: 'Converted Date' },
      { key: 'agentId', label: 'Assigned Agent' },
    ];
    exportToCsv(exportData, columns, 'Deals_Export');
    toast.success(`Exported ${exportData.length} deals to CSV`);
  };

  const tableColumns = useMemo(() => [
    { key: 'id', label: 'Deal ID', className: 'font-mono text-primary font-bold' },
    { key: 'name', label: 'Client Contact', render: (d) => <span className="font-bold text-on-surface">{d.name || 'Unnamed'}</span> },
    { key: 'company', label: 'Company', render: (d) => d.company || '—' },
    { key: 'stage', label: 'Stage', render: (d) => <StatusBadge status={d.stage || 'Waiting'} size="xs" /> },
    { 
      key: 'daysInStage', 
      label: 'Stage Age',
      accessor: (d) => {
        const stageDate = d.stageEnteredAt || d.date;
        return stageDate ? Math.max(0, Math.floor((Date.now() - new Date(stageDate).getTime()) / 86400000)) : 0;
      },
      render: (d) => {
        const stageDate = d.stageEnteredAt || d.date;
        const days = stageDate ? Math.max(0, Math.floor((Date.now() - new Date(stageDate).getTime()) / 86400000)) : 0;
        const isStale = days >= 8;
        const isWarning = days >= 4 && days < 8;
        return (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
            isStale ? 'text-rose-400 bg-rose-500/15 border-rose-500/30' : isWarning ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
          }`}>
            {days}d{isStale ? ' (Stale)' : ''}
          </span>
        );
      }
    },
    { key: 'value', label: 'Committed Value', align: 'right', render: (d) => <span className="font-mono font-bold text-on-surface">LKR {Number(d.value || 0).toLocaleString()}</span> },
    { key: 'date', label: 'Date', className: 'font-mono text-on-surface-variant' },
    { key: 'agentId', label: 'Agent', render: (d) => d.agentId || '—' },
  ], []);

  // Closes the double-click race window: a rapid second click on the same
  // card before the first async move (which awaits an atomic invoice-id
  // generation) resolves and re-renders could otherwise independently
  // trigger a second Final-invoice creation for the same deal.
  const [movingDealIds, setMovingDealIds] = useState(() => new Set());

  const handleMoveForward = async (dealId) => {
    if (movingDealIds.has(dealId)) return;
    setMovingDealIds(prev => new Set(prev).add(dealId));
    try {
      await handleMoveForwardInner(dealId);
    } finally {
      setMovingDealIds(prev => {
        const next = new Set(prev);
        next.delete(dealId);
        return next;
      });
    }
  };

  const handleMoveForwardInner = async (dealId) => {
    const dealBeingMoved = leads.find(d => d.id === dealId);
    if (!dealBeingMoved) return;
    const currentIndex = DEALS_STAGES.indexOf(dealBeingMoved.stage);
    if (currentIndex + 1 >= DEALS_STAGES.length) return;
    const nextStage = DEALS_STAGES[currentIndex + 1];
    const willComplete = nextStage === "Completed";

    // Firestore's atomic ID generator is async, so it must be resolved
    // BEFORE entering the synchronous setLeads updater below. Completing a
    // deal without its Final invoice would silently lose both the invoice
    // AND the commission it triggers (they used to be gated together only
    // by a boolean that a caught error could bypass) — so if the number
    // can't be generated, the whole move is aborted rather than completing
    // the deal anyway with a false "invoice generated" success message.
    let finalInvId = null;
    if (willComplete && onSaveInvoice) {
      try {
        finalInvId = await generateInvoiceId('Final');
      } catch (err) {
        toast.error('Could not generate the Final invoice number, so this deal was NOT marked Completed. Please try again: ' + err.message);
        return;
      }
    }

    const now = new Date().toISOString();
    let updatedDealObj = null;
    let persistedStage = null;
    let completionAborted = false;

    setLeads(prev => prev.map(deal => {
      if (deal.id !== dealId) return deal;
      // Re-validate against LIVE state rather than trusting the snapshot
      // taken before the await above — if the deal's stage changed in the
      // meantime (a concurrent edit, a rapid double-click), re-derive the
      // real next stage instead of blindly applying the stale one.
      const liveCurrentIndex = DEALS_STAGES.indexOf(deal.stage);
      if (liveCurrentIndex + 1 >= DEALS_STAGES.length) return deal;
      const liveNextStage = DEALS_STAGES[liveCurrentIndex + 1];

      if (liveNextStage === "Completed" && !finalInvId && onSaveInvoice) {
        // State changed underneath us: this move now completes the deal,
        // but no invoice id was reserved for that case. Never complete a
        // deal silently without its invoice — abort this update entirely.
        completionAborted = true;
        return deal;
      }

      persistedStage = liveNextStage;
      updatedDealObj = { ...deal, stage: liveNextStage, stageEnteredAt: now };

      if (liveNextStage === "Completed") {
        if (onSaveInvoice && finalInvId) {
          const linkedQuote = (quotations || []).find(q => matchesEntity(q, deal));
          const finalAmount = (deal.value || 0) * 0.25;
          onSaveInvoice({
            id: finalInvId,
            leadId: deal.id,
            dealId: deal.id,
            originalLeadId: deal.originalLeadId || '',
            linkedJobNo: deal.jobNo || deal.linkedJobNo || '',
            jobNo: deal.jobNo || deal.linkedJobNo || '',
            quotationId: linkedQuote?._firestoreId || linkedQuote?.id || '',
            customerName: deal.name || 'Direct Customer',
            company: deal.company || '',
            phone: deal.phone || '',
            date: new Date().toISOString().split('T')[0],
            amount: finalAmount,
            totalValue: deal.value || 0,
            advancePaid: (deal.value || 0) * 0.75,
            balanceDue: finalAmount,
            type: 'Final',
            status: 'Unpaid',
            aiDraft: deal.jobScope || `Final Settlement (25%) for project.`,
            dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            lineItems: linkedQuote?.lineItems || [
              { description: deal.jobScope || "Custom steel framing final balance settlement", qty: 1, unit: "job", unitPrice: finalAmount, taxPct: 0, discountPct: 0 }
            ]
          });
        }

        if (deal.agentId && partners.length && setPartners) {
          const sqFt = Number(deal.totalSqFt) || 0;
          const agent = partners.find(p => p.partnerId === deal.agentId);
          // Always the partner's CURRENT live rate, not a hardcoded default —
          // a rate change takes effect immediately for any deal completed after it.
          const commRate = Number(agent?.commissionRate) > 0 ? Number(agent.commissionRate) : 53.5;
          const commissionAmount = sqFt * commRate;

          if (agent) {
            setPartners(prevPartners => prevPartners.map(p =>
              p.partnerId === deal.agentId
                ? { ...p, pending: (p.pending || 0) + commissionAmount, totalSqFt: (p.totalSqFt || 0) + sqFt }
                : p
            ));
            // Update partner in Firestore
            updateDocument(COLLECTIONS.PARTNERS, agent._firestoreId || agent.partnerId, {
              pending: (agent.pending || 0) + commissionAmount,
              totalSqFt: (agent.totalSqFt || 0) + sqFt
            }).catch(err => console.error("Partner update error:", err));

            toast.success(`Deal Completed!`, {
              description: `LKR ${commissionAmount.toLocaleString()} commission assigned to Agent ${agent.name}. 25% Final Invoice generated.`
            });
          }
        } else {
          toast.success(`Deal Completed!`, {
            description: `25% Final Settlement Invoice generated successfully.`
          });
        }
      }
      return updatedDealObj;
    }));

    if (completionAborted) {
      toast.error('This deal moved to Completed elsewhere before this action finished, without an invoice reserved for it — please retry moving it forward.');
      return;
    }

    if (updatedDealObj && persistedStage) {
      try {
        await updateDocument(COLLECTIONS.LEADS, updatedDealObj._firestoreId || updatedDealObj.id, {
          stage: persistedStage,
          stageEnteredAt: now
        });
      } catch (err) {
        console.error("Deal move forward error:", err);
      }
    }
  };

  const handleCreateDeliveryJob = async (deal) => {
    const jobId = `L-DL-${String(Date.now()).slice(-6)}`;
    const newJob = {
      id: jobId,
      type: "Delivery",
      subType: "Framed Works / Finished Goods",
      location: deal.deliveryLocation || "Customer location TBD",
      customer: deal.name || "Direct Customer",
      company: deal.company || "",
      phone: deal.phone || "",
      status: "Pending",
      startTime: null,
      endTime: null,
      duration: null,
      manifest: `Delivery for Deal ${deal.id} - ${deal.company || deal.name || ''}`,
      dealId: deal.id,
      leadId: deal.originalLeadId || deal.id
    };
    if (setLogisticsJobs) {
      setLogisticsJobs(prev => [newJob, ...prev]);
    }
    try {
      await addDocument(COLLECTIONS.LOGISTICS, newJob, jobId);
      toast.success(`Delivery job ${jobId} created and dispatched to Logistics!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync delivery job to database");
    }
  };

  const handleMoveBackward = async (dealId) => {
    let updatedDealObj = null;
    let prevStageStr = null;

    setLeads(prev => prev.map(deal => {
      if (deal.id === dealId) {
        const currentIndex = DEALS_STAGES.indexOf(deal.stage);
        if (currentIndex > 0) {
          prevStageStr = DEALS_STAGES[currentIndex - 1];
          updatedDealObj = { ...deal, stage: prevStageStr };
          return updatedDealObj;
        }
      }
      return deal;
    }));

    if (updatedDealObj && prevStageStr) {
      try {
        await updateDocument(COLLECTIONS.LEADS, updatedDealObj._firestoreId || updatedDealObj.id, { stage: prevStageStr });
      } catch (err) {
        console.error("Deal move backward error:", err);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteDealId) {
      const targetDeal = leads.find(l => l.id === deleteDealId);
      setLeads(prev => prev.filter(deal => deal.id !== deleteDealId));
      
      if (targetDeal) {
        try {
          await deleteDocument(COLLECTIONS.LEADS, targetDeal._firestoreId || targetDeal.id);
          toast.success("Deal deleted successfully");
        } catch (err) {
          console.error("Delete deal error:", err);
          toast.error("Failed to delete deal from database");
        }
      }
      setDeleteDealId(null);
    }
  };

  const handleAddNewFallback = () => {
    toast.info("Deal creation usually occurs via Lead Conversion.");
  };

  const handleSaveDealDetails = async (updatedDeal) => {
    setLeads(prev => prev.map(deal => deal.id === updatedDeal.id ? updatedDeal : deal));
    setActiveDeal(null);
    try {
      await updateDocument(COLLECTIONS.LEADS, updatedDeal._firestoreId || updatedDeal.id, updatedDeal);
    } catch (err) {
      console.error("Save deal error:", err);
      toast.error("Failed to save deal to database");
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState('ALL');

  // Only display leads that are in deal pipeline stages (Waiting, Fabricating, Ready To Load, Hand Over, Completed)
  const activeDeals = leads.filter(l => l.isDeal && DEALS_STAGES.includes(l.stage));
  const totalDealsValue = activeDeals.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);

  const filteredDeals = activeDeals.filter(deal => {
    const matchesSearch = !searchQuery ||
      (deal.name && deal.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (deal.company && deal.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (deal.id && deal.id.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStage = filterStage === 'ALL' || deal.stage === filterStage;
    return matchesSearch && matchesStage;
  });

  const filterOptions = [
    { id: 'ALL', label: 'All Stages', count: activeDeals.length },
    ...DEALS_STAGES.map(stg => ({
      id: stg,
      label: stg,
      count: activeDeals.filter(d => d.stage === stg).length
    }))
  ];

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      {/* Unified Page Header */}
      <PageHeader
        title="Deals"
        subtitle="Track committed projects from waiting queue through fabrication, handover, and final settlement."
        metrics={[
          { label: "Committed Value", value: `LKR ${totalDealsValue.toLocaleString()}`, color: "secondary" },
          { label: "Active Deals", value: activeDeals.length, color: "default" }
        ]}
        actions={
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'kanban' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Kanban Board View"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">Board</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'table' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Sortable Table View"
              >
                <List size={14} />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleBulkExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface-container border border-outline-variant hover:border-primary/40 text-on-surface rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex-shrink-0"
              title="Export deals to CSV"
            >
              <Download size={14} className="text-primary" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={handleAddNewFallback}
              className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center space-x-2 active:scale-95"
            >
              <Plus size={16} />
              <span>New Deal</span>
            </button>
          </div>
        }
      />

      {/* Unified Search & Filter Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search deals by client, project, company..."
        activeFilter={filterStage}
        onFilterChange={setFilterStage}
        filterOptions={filterOptions}
        totalCount={activeDeals.length}
        filteredCount={filteredDeals.length}
      />

      {/* View Content: Board vs Table */}
      {viewMode === 'kanban' ? (
        <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory">
          <div className="flex space-x-3 sm:space-x-5 h-full min-w-max">
            {DEALS_STAGES.filter(stage => filterStage === 'ALL' || filterStage === stage).map((stage, idx) => (
              <DealColumn
                key={stage}
                stage={stage}
                items={filteredDeals.filter(d => d.stage === stage)}
                onMove={handleMoveForward}
                onMoveBack={handleMoveBackward}
                isFirstStage={idx === 0}
                isLastStage={idx === DEALS_STAGES.length - 1}
                onCardClick={setActiveDeal}
                onAddNew={handleAddNewFallback}
                isAdmin={isAdmin}
                onDelete={setDeleteDealId}
                onCreateDelivery={handleCreateDeliveryJob}
                logisticsJobs={logisticsJobs}
                movingDealIds={movingDealIds}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">
          <SortableTable
            columns={tableColumns}
            data={filteredDeals}
            onRowClick={(deal) => setActiveDeal(deal)}
            selectable={true}
            selectedIds={selectedDealIds}
            onSelectionChange={setSelectedDealIds}
            idKey="id"
            emptyMessage="No matching deals found in this pipeline filter."
            bulkActions={
              <div className="flex items-center gap-2">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkStageChange(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="bg-surface-container border border-outline-variant text-xs text-on-surface rounded-lg px-2.5 py-1 outline-none font-bold"
                >
                  <option value="" disabled>Move to Stage...</option>
                  {DEALS_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  type="button"
                  onClick={handleBulkExportCsv}
                  className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 border border-primary/30 px-2.5 py-1 rounded-lg hover:bg-primary/20 transition-colors"
                >
                  <Download size={12} />
                  <span>Export Selected</span>
                </button>
              </div>
            }
          />
        </div>
      )}

      {/* Delete Deal modal */}
      <DeleteModal
        isOpen={!!deleteDealId}
        onClose={() => setDeleteDealId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Deal?"
        message="Are you sure you want to permanently delete this deal? This will remove all project and financial tracking for this item."
      />

      {/* Deal details Modal */}
      {activeDeal && (
        <LeadCardDetails
          lead={activeDeal}
          onClose={() => setActiveDeal(null)}
          onSave={handleSaveDealDetails}
          onSaveInvoice={onSaveInvoice}
          onMarkInvoicePaid={onMarkInvoicePaid}
          partners={partners}
          customers={customers}
          currentUser={currentUser}
          allQuotations={quotations}
          logisticsJobs={logisticsJobs}
          onCreateLogistics={handleCreateDeliveryJob}
          invoices={invoices}
          receipts={receipts}
          onGenerateReceipt={onGenerateReceipt}
          isDeal={true}
          onConvert={() => {
            // Conversion should ideally be hidden for active deals, but we provide a no-op just in case
            toast.info("This item is already an active deal.");
          }}
        />
      )}
    </div>
  );
}
