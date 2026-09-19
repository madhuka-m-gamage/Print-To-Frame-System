import React, { useState, useMemo } from 'react';
import { 
  Plus, ArrowLeft, ArrowRight, Truck, Check, Trash2, Calendar, 
  User, DollarSign, Archive, X, LayoutGrid, List, Download, ArrowUpDown, Clock, Sparkles
} from 'lucide-react';
import { toast } from '../../utils/toast';
import LeadCardDetails from './LeadCardDetails';
import DeleteModal from '../common/DeleteModal';
import { PageHeader, FilterBar, StatusBadge, KanbanColumn, KanbanCard, DetailModalLayout, DetailModalHeader, DetailModalFooter } from '../common/ui';
import SortableTable from '../common/ui/SortableTable';
import { addDocument, updateDocument, deleteDocument, COLLECTIONS } from '../../services/firestoreSync';
import { sanitizeTechnicalScope, stripEmojis } from '../../utils/validation';
import { exportToCsv } from '../../utils/csvExport';
import { logActivity } from '../../services/auditLog';

const STAGES = ["Intake", "Processing", "75% Invoice Submitted", "Received", "Completed"];

const STAGE_COLORS = {
  "Intake": "primary",
  "Processing": "primary",
  "75% Invoice Submitted": "purple",
  "Received": "secondary",
  "Completed": "emerald"
};

function LeadColumn({ 
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
  onCreateLogistics,
  logisticsJobs
}) {
  return (
    <KanbanColumn
      title={stage}
      count={items.length}
      stageColor={STAGE_COLORS[stage] || "primary"}
      onAddNew={stage === "Intake" ? onAddNew : null}
      addNewText="Add New Lead"
    >
      {items.map((lead) => {
        // Calculate days in current stage
        const stageDate = lead.stageEnteredAt || lead.date;
        const daysInStage = stageDate ? Math.max(0, Math.floor((Date.now() - new Date(stageDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;
        const isStale = daysInStage >= 8;
        const isWarning = daysInStage >= 4 && daysInStage < 8;

        const badges = (
          <>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase border border-primary/20">
                {lead.source || 'Manual'}
              </span>
              {(lead.source === 'Referral' || lead.source === 'Partner Referral') && (
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1 animate-pulse" title={`Referred by ${lead.partnerName || 'Partner'}`}>
                  <Clock size={10} /> 5-Min SLA
                </span>
              )}
              {/* Days in stage badge */}
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

            <div className="flex flex-col items-end space-y-1">
              <span className="text-[10px] text-on-surface-variant font-medium flex items-center">
                <Calendar size={10} className="mr-1 opacity-70" />
                {lead.date}
              </span>
              {lead.invoicePaid ? (
                <StatusBadge status="Paid" size="xs" />
              ) : lead.invoiceGenerated ? (
                <span className="text-[9px] text-secondary font-bold flex items-center bg-secondary/10 px-1.5 py-0.5 rounded border border-secondary/20">
                  Inv: {lead.invoiceDate || 'Pending'}
                </span>
              ) : null}
            </div>
          </>
        );

        const subtitle = (
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center text-xs text-on-surface-variant">
              <User size={12} className="mr-1.5 opacity-60" />
              {lead.name || 'Unnamed Contact'}
            </span>
            {lead.agentId && (
              <span className="text-[9px] font-bold text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant" title={`Assigned Agent: ${lead.agentId}`}>
                {lead.agentId}
              </span>
            )}
          </div>
        );

        const metrics = (
          <div className="flex items-center text-on-surface">
            <DollarSign size={14} className="mr-0.5 text-on-surface-variant" />
            <span className="text-xs font-bold font-mono">
              LKR {Number(lead.value || 0).toLocaleString()}
            </span>
          </div>
        );

        const customActions = (
          <>
            {stage === "75% Invoice Submitted" && (() => {
              const job = logisticsJobs ? logisticsJobs.find(j => j.leadId === lead.id) : null;
              if (job && job.status === "Completed") {
                return (
                  <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-secondary/10 text-secondary border border-secondary/20" title="Pickup Completed">
                    <Check size={12} />
                    <span className="text-[10px] font-bold">Picked Up</span>
                  </div>
                );
              }
              if (job) {
                return (
                  <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20" title="Logistics Requested">
                    <Truck size={12} />
                    <span className="text-[10px] font-bold">Requested</span>
                  </div>
                );
              }
              return (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateLogistics(lead);
                  }}
                  className="p-1.5 rounded-lg bg-error/10 text-error hover:bg-error hover:text-on-error transition-all border border-error/20"
                  title="Create Logistics Pickup Job"
                >
                  <Truck size={13} />
                </button>
              );
            })()}

            {isLastStage && (
              lead.convertedToDeal ? (
                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-[9px] font-bold flex items-center gap-1" title="Lead has been converted to a deal">
                  <Check size={11} /> Converted
                </span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(lead.id);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-secondary text-on-secondary hover:bg-secondary/90 font-bold text-[10px] uppercase tracking-wider transition-all flex items-center space-x-1"
                  title="Convert to Deal"
                >
                  <Check size={12} />
                  <span>Convert</span>
                </button>
              )
            )}
          </>
        );

        return (
          <KanbanCard
            key={lead.id}
            id={lead.id}
            title={lead.company || lead.name || 'No Company'}
            subtitle={subtitle}
            badges={badges}
            metrics={metrics}
            onClick={() => onCardClick(lead)}
            onMoveBack={() => onMoveBack(lead.id)}
            onMoveForward={() => onMove(lead.id)}
            onDelete={() => onDelete(lead.id)}
            isAdmin={isAdmin}
            isFirstStage={isFirstStage}
            isLastStage={isLastStage}
            customActions={customActions}
          />
        );
      })}
    </KanbanColumn>
  );
}

// Convert Modal
function ConvertDealModal({ lead, onClose, onConfirm }) {
  const [invoiceText, setInvoiceText] = useState(lead?.invoiceDraft || '');

  const generateManualInvoiceDraft = () => {
    setInvoiceText(`# 75% Advance Invoice\n\n- Client: ${lead.name}\n- Value: LKR ${(lead.value * 0.75).toLocaleString()}\n\n[Please review and edit details to complete]`);
  };

  const handleConfirm = () => {
    onConfirm({
      ...lead,
      stage: 'Waiting',
      invoiceDraft: invoiceText
    });
  };

  return (
    <DetailModalLayout isOpen={true} onClose={onClose} ariaLabel="Convert Lead to Deal">
      <DetailModalHeader
        title={`Convert to Deal: ${lead.name || 'Lead'}`}
        id={lead.id}
        badge={
          <StatusBadge status="Deal Conversion" size="sm" />
        }
        subtitle={
          <span>
            {lead.invoiceGenerated ? "Review the generated 75% Advance Invoice to finalize the commitment." : "Generate 75% Advance Invoice to finalize the commitment."}
          </span>
        }
        onClose={onClose}
      />

      <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
        <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant">
          <h3 className="text-xs font-bold text-on-surface mb-4 flex items-center uppercase tracking-widest text-primary">
            Job Overview & Commercial Terms
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-surface-container rounded-xl border border-outline-variant">
              <span className="block text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Total Quoted Value</span>
              <span className="text-base font-extrabold text-primary font-mono">LKR {(lead.value || 0).toLocaleString()}</span>
            </div>
            <div className="p-3 bg-surface-container rounded-xl border border-outline-variant">
              <span className="block text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">75% Advance Due</span>
              <span className="text-base font-extrabold text-secondary font-mono">LKR {((lead.value || 0) * 0.75).toLocaleString()}</span>
            </div>
            <div className="p-3 bg-surface-container rounded-xl border border-outline-variant">
              <span className="block text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Delivery Location</span>
              <span className="text-xs font-bold text-on-surface">{lead.deliveryLocation || 'TBD'}</span>
            </div>
          </div>

          {!lead.invoiceGenerated && (
            <div className="mt-4">
              <button
                type="button"
                onClick={generateManualInvoiceDraft}
                className="px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container font-bold text-xs transition-all flex items-center space-x-2"
              >
                <span>Create Manual Draft (Skip AI)</span>
              </button>
            </div>
          )}
        </div>

        {invoiceText && (
          <div className="flex flex-col flex-1 min-h-[260px] space-y-2">
            <label className="block text-[10px] uppercase font-bold text-secondary tracking-widest flex items-center">
              <Check size={12} className="mr-1" /> Invoice details draft
            </label>
            <textarea
              value={invoiceText}
              onChange={(e) => setInvoiceText(e.target.value)}
              rows={8}
              className="w-full p-4 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-secondary/50 resize-y"
            />
          </div>
        )}
      </div>

      <DetailModalFooter
        onClose={onClose}
        closeText="Cancel"
        primaryActions={
          <button
            type="button"
            onClick={handleConfirm}
            className="px-6 py-2.5 bg-secondary text-on-secondary hover:bg-secondary/90 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 flex items-center space-x-2 shadow-sm"
          >
            <Check size={16} />
            <span>Finalize Conversion to Deal</span>
          </button>
        }
      />
    </DetailModalLayout>
  );
}


export default function Leads({
  leads,
  setLeads,
  logisticsJobs,
  setLogisticsJobs,
  setProjects,
  currentUser,
  onSaveInvoice,
  onMarkInvoicePaid,
  customers = [],
  setCustomers,
  partners = [],
  quotations = [],
  invoices = [],
  receipts = [],
  onGenerateReceipt,
}) {
  const [activeLead, setActiveLead] = useState(null);
  const [leadToConvert, setLeadToConvert] = useState(null);
  const [deleteLeadId, setDeleteLeadId] = useState(null);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const isAdmin = currentUser?.role === "Admin";

  const handleBulkStageChange = async (targetStage) => {
    if (!selectedLeadIds.length) return;
    const now = new Date().toISOString();
    setLeads(prev => prev.map(l => selectedLeadIds.includes(l.id) ? { ...l, stage: targetStage, stageEnteredAt: now } : l));
    try {
      await Promise.all(selectedLeadIds.map(id => {
        const lead = leads.find(l => l.id === id);
        return updateDocument(COLLECTIONS.LEADS, lead?._firestoreId || id, { stage: targetStage, stageEnteredAt: now });
      }));
      toast.success(`Moved ${selectedLeadIds.length} leads to "${targetStage}"`);
      setSelectedLeadIds([]);
    } catch (err) {
      toast.error('Bulk update failed: ' + err.message);
    }
  };

  const handleBulkExportCsv = () => {
    const exportData = filteredLeads.filter(l => selectedLeadIds.length === 0 || selectedLeadIds.includes(l.id));
    const columns = [
      { key: 'id', label: 'Lead ID' },
      { key: 'name', label: 'Contact Name' },
      { key: 'company', label: 'Company' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'stage', label: 'Current Stage' },
      { key: 'value', label: 'Estimated Value (LKR)' },
      { key: 'date', label: 'Created Date' },
      { key: 'deliveryLocation', label: 'Delivery Location' },
      { key: 'agentId', label: 'Assigned Agent' },
    ];
    exportToCsv(exportData, columns, 'Leads_Export');
    toast.success(`Exported ${exportData.length} leads to CSV`);
  };

  const tableColumns = useMemo(() => [
    { key: 'id', label: 'Lead ID', className: 'font-mono text-primary font-bold' },
    { key: 'name', label: 'Contact Name', render: (l) => <span className="font-bold text-on-surface">{l.name || 'Unnamed'}</span> },
    { key: 'company', label: 'Company', render: (l) => l.company || '—' },
    { key: 'stage', label: 'Stage', render: (l) => <StatusBadge status={l.stage || 'Intake'} size="xs" /> },
    { 
      key: 'daysInStage', 
      label: 'Stage Age',
      accessor: (l) => {
        const stageDate = l.stageEnteredAt || l.date;
        return stageDate ? Math.max(0, Math.floor((Date.now() - new Date(stageDate).getTime()) / 86400000)) : 0;
      },
      render: (l) => {
        const stageDate = l.stageEnteredAt || l.date;
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
    { key: 'value', label: 'Value', align: 'right', render: (l) => <span className="font-mono font-bold text-on-surface">LKR {Number(l.value || 0).toLocaleString()}</span> },
    { key: 'date', label: 'Date', className: 'font-mono text-on-surface-variant' },
    { key: 'agentId', label: 'Owner', render: (l) => l.agentId || '—' },
  ], []);

  const handleAddNewLead = async () => {
    const now = new Date().toISOString();
    const newLead = {
      id: `L-${String(Date.now()).slice(-6)}`,
      name: "",
      company: "",
      phone: "",
      email: "",
      value: 0,
      stage: "Intake",
      stageEnteredAt: now,
      source: "Manual",
      date: now.split("T")[0],
      jobScope: "",
      deliveryLocation: "",
      quotationGenerated: false,
      quotationDraft: "",
    };
    // Optimistic UI update
    setLeads(prev => [...prev, newLead]);
    setActiveLead(newLead);
    // Persist to Firestore
    try {
      await addDocument(COLLECTIONS.LEADS, newLead, newLead.id);
    } catch (error) {
      console.error("Failed to add new lead to DB:", error);
      toast.error("Failed to sync new lead to database");
    }
  };

  // OPTIMIZATION 7: Automatic Client Creation upon saving Lead Details (Prevent Duplicates)
  const handleSaveLeadDetails = async (updatedLead) => {
    const currentLead = leads.find(l => l.id === updatedLead.id);
    const cleanedLead = {
      ...updatedLead,
      stage: updatedLead.stage || currentLead?.stage || 'Intake',
      isDeal: false,
      convertedToDeal: !!currentLead?.convertedToDeal,
      convertedDealId: currentLead?.convertedDealId || null,
    };

    setLeads(prev => prev.map(lead => lead.id === cleanedLead.id ? cleanedLead : lead));
    // Keep the modal's lead prop in sync so subsequent saves don't use stale data
    setActiveLead(cleanedLead);

    // Persist to Firestore
    try {
      const firestoreId = cleanedLead._firestoreId || cleanedLead.id;
      await updateDocument(COLLECTIONS.LEADS, firestoreId, cleanedLead);
    } catch (error) {
      console.error("Failed to update lead in DB:", error);
      toast.error("Failed to save changes to database");
    }

    // Save lead details must auto-create client in customer database if doesn't exist
    if (updatedLead.name && setCustomers) {
      const match = customers.find(c => 
        (updatedLead.email && c.email === updatedLead.email) || 
        (updatedLead.phone && c.phone === updatedLead.phone)
      );

      if (match) {
        console.log('Customer already exists in DB:', match.name);
      } else {
        // Create new customer
        const nicId = `AUTO-${Math.floor(100000 + Math.random() * 900000)}`;
        const newCustomer = {
          nic: nicId,
          name: updatedLead.name,
          company: updatedLead.company,
          phone: updatedLead.phone,
          email: updatedLead.email,
          type: updatedLead.company ? "Business" : "Individual",
          businessName: updatedLead.company || "",
          orders: 1,
          dateJoined: new Date().toISOString().split('T')[0]
        };
        setCustomers(prev => [...prev, newCustomer]);
        try {
          await addDocument(COLLECTIONS.CUSTOMERS, newCustomer, nicId);
          console.log('Automatically created customer profile:', newCustomer.name);
        } catch (err) {
          console.error("Failed to auto-create customer:", err);
        }
      }
    }
  };

  const handleConvertConfirm = async (convertedLead) => {
    const originalLead = leads.find(lead => lead.id === convertedLead.id);
    if (!originalLead) return;

    if (originalLead.convertedToDeal) {
      toast.info('This lead has already been converted to a deal.');
      setLeadToConvert(null);
      return;
    }

    // Generate a unique ID for the Deal and master Job Number
    const dealId = `D-${String(Date.now()).slice(-6)}`;
    const jobNo = convertedLead.jobNo || `PTF-${String(Date.now()).slice(-4)}`;
    const now = new Date().toISOString();

    // Create the new deal record starting in Waiting stage of Deals pipeline
    const newDeal = {
      ...convertedLead,
      id: dealId,
      jobNo: jobNo,
      linkedJobNo: jobNo,
      isDeal: true,
      stage: 'Waiting',
      stageEnteredAt: now,
      convertedToDeal: false,
      originalLeadId: originalLead.id,
    };

    // Mark the original lead as Completed and locked
    const updatedOriginalLead = {
      ...convertedLead,
      id: originalLead.id,
      stage: 'Completed',
      stageEnteredAt: now,
      isDeal: false,
      convertedToDeal: true,
      convertedDealId: dealId,
      invoiceDraft: originalLead.invoiceDraft || convertedLead.invoiceDraft
    };

    // Save state update optimistically
    setLeads(prev => [...prev.map(l => l.id === originalLead.id ? updatedOriginalLead : l), newDeal]);
    
    // Push to Firestore
    try {
      await updateDocument(COLLECTIONS.LEADS, originalLead._firestoreId || originalLead.id, { 
        stage: 'Completed', 
        isDeal: false,
        convertedToDeal: true,
        convertedDealId: dealId,
        stageEnteredAt: now
      });
      await addDocument(COLLECTIONS.LEADS, newDeal, dealId);
    } catch (err) {
      console.error("Convert Deal Firestore error:", err);
      toast.error("Failed to sync deal conversion");
    }
    
    // Increment customer order or add customer if missing
    if (convertedLead.name && setCustomers) {
      const match = customers.find(c => 
        (convertedLead.email && c.email === convertedLead.email) || 
        (convertedLead.phone && c.phone === convertedLead.phone)
      );

      if (match) {
        setCustomers(prev => prev.map(c => 
          c.nic === match.nic ? { ...c, orders: (c.orders || 0) + 1 } : c
        ));
        try {
          await updateDocument(COLLECTIONS.CUSTOMERS, match._firestoreId || match.nic, { orders: (match.orders || 0) + 1 });
        } catch(err) {
          console.error(err);
        }
      } else {
        const nicId = `AUTO-${Math.floor(100000 + Math.random() * 900000)}`;
        const newCustomer = {
          nic: nicId,
          name: convertedLead.name,
          company: convertedLead.company,
          phone: convertedLead.phone,
          email: convertedLead.email,
          type: convertedLead.company ? "Business" : "Individual",
          businessName: convertedLead.company || "",
          orders: 1,
          dateJoined: new Date().toISOString().split('T')[0]
        };
        setCustomers(prev => [...prev, newCustomer]);
        try {
          await addDocument(COLLECTIONS.CUSTOMERS, newCustomer, nicId);
        } catch(err) {
          console.error(err);
        }
      }
    }

    // Create a fabrication project job (Pending status)
    if (setProjects) {
      const newJob = {
        jobNo: jobNo,
        clientNIC: convertedLead.nic || `AUTO-${Math.floor(100000 + Math.random() * 900000)}`,
        scope: sanitizeTechnicalScope(convertedLead.jobScope) || "Custom steel framing work",
        status: "Pending",
        deadline: convertedLead.date || new Date().toISOString().split('T')[0],
        address: stripEmojis(convertedLead.deliveryLocation) || "Pickup at Colombo Hub",
        materials: "",
        note: "Lead converted via Kanban pipeline.",
        assignee: "",
        flexReceived: false,
        value: convertedLead.value || 0,
        totalSqFt: convertedLead.totalSqFt || 0,
        leadId: convertedLead.id,
        dealId: dealId,
        customerName: convertedLead.name || "",
        customerPhone: convertedLead.phone || "",
        company: convertedLead.company || "",
      };
      setProjects(prev => [newJob, ...prev]);

      try {
        await addDocument(COLLECTIONS.PROJECTS, newJob, jobNo);
      } catch(err) {
        console.error(err);
      }
    }

    toast.success('New Order Received!', {
      description: `Lead ${convertedLead.name} has been converted to a deal and added to Fabrication.`,
    });

    setLeadToConvert(null);
    setActiveLead(null); // Close the active lead modal to return to Kanban
  };

  const handleMoveForward = async (leadId) => {
    const targetLead = leads.find(l => l.id === leadId);
    if (!targetLead) return;
    
    if (targetLead.stage === "Received") {
      // Trigger Convert Deal modal
      setLeadToConvert(targetLead);
    } else if (targetLead.stage !== "Completed") {
      const currentIndex = STAGES.indexOf(targetLead.stage);
      const nextStage = STAGES[currentIndex + 1];
      const now = new Date().toISOString();
      const updatedLead = { ...targetLead, stage: nextStage, stageEnteredAt: now };
      setLeads(prev => prev.map(l => l.id === leadId ? updatedLead : l));
      
      try {
        await updateDocument(COLLECTIONS.LEADS, updatedLead._firestoreId || updatedLead.id, { 
          stage: nextStage, 
          stageEnteredAt: now 
        });
      } catch (err) {
        console.error("Move lead error:", err);
      }
    }
  };

  const handleMoveBackward = async (leadId) => {
    const targetLead = leads.find(l => l.id === leadId);
    if (!targetLead) return;
    
    const currentIndex = STAGES.indexOf(targetLead.stage);
    if (currentIndex > 0) {
      const prevStage = STAGES[currentIndex - 1];
      const now = new Date().toISOString();
      const updatedLead = { ...targetLead, stage: prevStage, stageEnteredAt: now };
      setLeads(prev => prev.map(l => l.id === leadId ? updatedLead : l));
      
      try {
        await updateDocument(COLLECTIONS.LEADS, updatedLead._firestoreId || updatedLead.id, { 
          stage: prevStage, 
          stageEnteredAt: now 
        });
      } catch (err) {
        console.error("Move back error:", err);
      }
    }
  };

  const handleDeleteLead = async () => {
    if (deleteLeadId) {
      const targetLead = leads.find(l => l.id === deleteLeadId);
      setLeads(prev => prev.filter(l => l.id !== deleteLeadId));
      
      if (targetLead) {
        try {
          await deleteDocument(COLLECTIONS.LEADS, targetLead._firestoreId || targetLead.id);
          toast.success("Lead permanently deleted");
          logActivity(currentUser?.identifier, currentUser?.name, 'LEAD_DELETED', 'Leads', `Lead ${targetLead.id} (${targetLead.name || 'unnamed'}) permanently deleted`);
        } catch (err) {
          console.error("Delete lead error:", err);
          toast.error("Failed to delete lead from database");
        }
      }
      setDeleteLeadId(null);
    }
  };

  const handleCreateLogisticsJob = async (lead) => {
    const jobId = `L-PK-${String(Date.now()).slice(-6)}`;
    const newLogisticsJob = {
      id: jobId,
      type: "Pickup",
      subType: "Material/Flex",
      location: stripEmojis(lead.deliveryLocation) || "Customer location TBD",
      customer: stripEmojis(lead.name),
      status: "Pending",
      startTime: null,
      endTime: null,
      duration: null,
      manifest: null,
      leadId: lead.id
    };
    setLogisticsJobs(prev => [newLogisticsJob, ...prev]);
    
    try {
      await addDocument(COLLECTIONS.LOGISTICS, newLogisticsJob, jobId);
    } catch(err) {
      console.error(err);
      toast.error("Failed to sync new logistics job to database");
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState('ALL');

  // Filter leads based on search query and optional stage filter
  const nonDealLeads = leads.filter(l => !l.isDeal);
  const totalPipelineValue = nonDealLeads.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);

  const filteredLeads = nonDealLeads.filter(lead => {
    const matchesSearch = !searchQuery || 
      (lead.name && lead.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (lead.company && lead.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (lead.id && lead.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (lead.phone && lead.phone.includes(searchQuery));
    const matchesStage = filterStage === 'ALL' || lead.stage === filterStage;
    return matchesSearch && matchesStage;
  });

  const filterOptions = [
    { id: 'ALL', label: 'All Stages', count: nonDealLeads.length },
    ...STAGES.map(stg => ({
      id: stg,
      label: stg,
      count: nonDealLeads.filter(l => l.stage === stg).length
    }))
  ];

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      {/* Unified Page Header */}
      <PageHeader
        title="Leads"
        subtitle="Nurture incoming inquiries from intake to quotation and 75% advance payment."
        metrics={[
          { label: "Active Pipeline", value: `LKR ${totalPipelineValue.toLocaleString()}`, color: "primary" },
          { label: "Total Leads", value: nonDealLeads.length, color: "default" }
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
              title="Export leads to CSV"
            >
              <Download size={14} className="text-primary" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={handleAddNewLead}
              className="bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center space-x-2 active:scale-95 shadow-[0_0_15px_rgba(0,218,243,0.2)]"
            >
              <Plus size={16} />
              <span>New Lead</span>
            </button>
          </div>
        }
      />

      {/* Unified Search & Filter Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search leads by client name, company, phone, ID..."
        activeFilter={filterStage}
        onFilterChange={setFilterStage}
        filterOptions={filterOptions}
        totalCount={nonDealLeads.length}
        filteredCount={filteredLeads.length}
      />

      {/* View Content: Kanban Grid vs Sortable Table */}
      {viewMode === 'kanban' ? (
        <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex space-x-5 h-full min-w-max">
            {STAGES.filter(stage => filterStage === 'ALL' || filterStage === stage).map((stage, idx) => (
              <LeadColumn
                key={stage}
                stage={stage}
                items={filteredLeads.filter(l => l.stage === stage)}
                onMove={handleMoveForward}
                onMoveBack={handleMoveBackward}
                isFirstStage={idx === 0}
                isLastStage={idx === STAGES.length - 1}
                onCardClick={setActiveLead}
                onAddNew={handleAddNewLead}
                isAdmin={isAdmin}
                onDelete={setDeleteLeadId}
                onCreateLogistics={handleCreateLogisticsJob}
                logisticsJobs={logisticsJobs}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">
          <SortableTable
            columns={tableColumns}
            data={filteredLeads}
            onRowClick={(lead) => setActiveLead(lead)}
            selectable={true}
            selectedIds={selectedLeadIds}
            onSelectionChange={setSelectedLeadIds}
            idKey="id"
            emptyMessage="No matching leads in this pipeline filter."
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
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
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

      {/* Lead details Modal */}
      {activeLead && (
        <LeadCardDetails
          lead={activeLead}
          onClose={() => setActiveLead(null)}
          onSave={handleSaveLeadDetails}
          onSaveInvoice={onSaveInvoice}
          onMarkInvoicePaid={onMarkInvoicePaid}
          invoices={invoices}
          receipts={receipts}
          onGenerateReceipt={onGenerateReceipt}
          partners={partners}
          customers={customers}
          currentUser={currentUser}
          allQuotations={quotations}
          onConvert={(updatedLead) => {
            setActiveLead(null);
            setLeadToConvert(updatedLead);
          }}
        />
      )}

      {/* Deal Conversion Modal */}
      {leadToConvert && (
        <ConvertDealModal
          lead={leadToConvert}
          onClose={() => setLeadToConvert(null)}
          onConfirm={handleConvertConfirm}
        />
      )}

      {/* Delete Lead Modal */}
      <DeleteModal
        isOpen={!!deleteLeadId}
        onClose={() => setDeleteLeadId(null)}
        onConfirm={handleDeleteLead}
        title="Delete Lead?"
        message="Are you sure you want to permanently delete this lead from the intake pipeline? This cannot be undone."
      />
    </div>
  );
}
