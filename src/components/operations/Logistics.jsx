import React, { useState, useMemo } from 'react';
import { 
  Truck, 
  MapPin, 
  Download, 
  Loader, 
  Trash2, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  X, 
  FileText, 
  Plus, 
  Upload, 
  Bell, 
  User, 
  Clock,
  Navigation,
  Phone,
  MessageSquare,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Layers,
  Sparkles
} from 'lucide-react';
import { toast } from '../../utils/toast';
import Card from '../common/Card';
import DeleteModal from '../common/DeleteModal';
import LogisticsCardDetails from './LogisticsCardDetails';
import { PageHeader, FilterBar, StatusBadge, KanbanColumn, KanbanCard, ModalWrapper } from '../common/ui';
import TwoToneIcon from '../common/ui/TwoToneIcon';
import { addDocument, updateDocument, deleteDocument, COLLECTIONS, generateAtomicId } from '../../services/firestoreSync';
import { stripEmojis } from '../../utils/validation';
import { 
  getGoogleMapsUrl, 
  getWhatsAppUrl, 
  formatDispatchMessage, 
  calculateCODFromInvoices,
  FLEET_VEHICLES,
  DRIVER_DIRECTORY 
} from '../../utils/logisticsEngine';

const STAGES = ["Pending", "In Transit", "Completed"];

const STAGE_COLORS = {
  "Pending": "amber",
  "In Transit": "primary",
  "Completed": "emerald"
};

const getDriverShort = (name) => {
  if (!name) return "";
  return name.split(' ')[0];
};

const getVehicleShort = (v) => {
  if (!v) return "";
  if (v.includes('(')) {
    return v.split('(')[1].replace(')', '');
  }
  return v;
};

function LogisticsColumn({
  stage,
  items,
  onMove,
  onMoveBack,
  isFirstStage,
  isLastStage,
  onAddNew,
  isAdmin,
  onDelete,
  onCardClick,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  draggedJobId,
  invoices = []
}) {
  return (
    <KanbanColumn
      title={stage}
      count={items.length}
      stageColor={STAGE_COLORS[stage] || "primary"}
      onAddNew={isFirstStage ? onAddNew : null}
      addNewText="Add Task"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, null, stage)}
    >
      {items.map((job) => {
        // Calculate COD for card badge
        const { hasUnpaid, totalBalanceDue, primaryInvoice } = calculateCODFromInvoices(invoices, job.linkedJobNo, job.customer, {
          entity: job,
          invoiceId: job.invoiceId
        });

        const badges = (
          <>
            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
              {job.status === "In Transit" && (
                <span className="relative flex h-2 w-2 mr-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
              <span className="font-mono text-[10px] font-bold text-on-surface-variant tracking-wider">{job.id}</span>
              
              {job.linkedJobNo && (
                <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                  #{job.linkedJobNo}
                </span>
              )}

              {/* COD / Payment Status Badge with matching DB Invoice Code */}
              {hasUnpaid ? (
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center">
                  <DollarSign size={9} className="mr-0.5 text-amber-400" />
                  COD: LKR {totalBalanceDue.toLocaleString()}
                  {primaryInvoice?.id && (
                    <span className="ml-1 opacity-80 font-mono">({primaryInvoice.id})</span>
                  )}
                </span>
              ) : (
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center">
                  <CheckCircle2 size={9} className="mr-0.5 text-emerald-400" />
                  Settled
                  {primaryInvoice?.id && (
                    <span className="ml-1 opacity-80 font-mono">({primaryInvoice.id})</span>
                  )}
                </span>
              )}

              {job.notified && (
                <span className="text-secondary flex items-center" title="Client Dispatch Alert Sent">
                  <Bell size={11} className="fill-emerald-500" />
                </span>
              )}
            </div>

            {job.customer && (
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase max-w-[130px] truncate border border-primary/20">
                {job.customer}
              </span>
            )}
          </>
        );

        const subtitle = (
          <span className="flex items-center text-xs text-on-surface-variant">
            <Truck size={12} className="mr-1.5 opacity-60 text-primary" />
            <span className="truncate">{job.subType || 'General Freight'}</span>
          </span>
        );

        const details = (
          <div className="space-y-1.5 mb-2">
            {(job.driver || job.vehicle) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {job.driver && (
                  <span className="inline-flex items-center text-[9px] bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded border border-outline-variant/50 font-bold uppercase tracking-tight">
                    <User size={10} className="mr-1 text-on-surface-variant" />
                    {getDriverShort(job.driver)}
                  </span>
                )}
                {job.vehicle && (
                  <span className="inline-flex items-center text-[9px] bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded border border-outline-variant/50 font-bold uppercase tracking-tight">
                    <Truck size={10} className="mr-1 text-on-surface-variant" />
                    {getVehicleShort(job.vehicle)}
                  </span>
                )}
              </div>
            )}
            {job.manifest && (
              <div className="p-1.5 bg-surface-container-high rounded border border-outline-variant flex items-center text-[10px] text-on-surface-variant">
                <FileText size={12} className="mr-1.5 text-on-surface-variant flex-shrink-0" />
                <span className="truncate font-medium">{job.manifest}</span>
              </div>
            )}
            {job.receivedBy && (
              <div className="text-[10px] text-emerald-400 font-semibold flex items-center">
                <CheckCircle2 size={11} className="mr-1 text-emerald-400" />
                <span>Received by: {job.receivedBy}</span>
              </div>
            )}
          </div>
        );

        // Direct road quick actions right on card
        const customActions = (
          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
            {/* 1-Tap Google Maps */}
            {job.location && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const url = getGoogleMapsUrl(job.location);
                  if (url) window.open(url, '_blank');
                }}
                className="p-1.5 rounded-lg border bg-primary/10 text-primary hover:bg-primary/20 border-primary/30 transition-all active:scale-95"
                title="Open in Google Maps"
              >
                <Navigation size={13} />
              </button>
            )}

            {/* 1-Tap WhatsApp Alert */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const matchedDriver = DRIVER_DIRECTORY.find(d => d.name === job.driver);
                const msg = formatDispatchMessage({
                  customerName: job.customer,
                  location: job.location,
                  subType: job.subType,
                  driverName: job.driver,
                  driverPhone: matchedDriver?.phone || '',
                  vehiclePlate: job.vehicle,
                  id: job.id,
                  balanceDue: totalBalanceDue
                });
                const url = getWhatsAppUrl(job.customerPhone, msg);
                window.open(url, '_blank');
              }}
              className="p-1.5 rounded-lg border bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 transition-all active:scale-95"
              title="Send WhatsApp Dispatch Notice"
            >
              <MessageSquare size={13} />
            </button>

            {/* 1-Tap Phone Call if available */}
            {job.customerPhone && (
              <a
                href={`tel:${job.customerPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg border bg-surface-container-high text-on-surface-variant hover:text-secondary hover:bg-secondary/10 border-outline-variant/60 transition-all active:scale-95"
                title={`Call ${job.customerPhone}`}
              >
                <Phone size={13} />
              </a>
            )}
          </div>
        );

        const metrics = (
          <div className="flex items-center text-[10px] uppercase font-bold tracking-wide">
            {job.status === "Completed" && (
              <span className="flex items-center bg-secondary/10 text-secondary px-2 py-0.5 rounded border border-secondary/30">
                <Clock size={11} className="mr-1 text-secondary" />
                {job.duration || "Delivered"}
              </span>
            )}
            {job.status === "In Transit" && job.startTime && (
              <span className="flex items-center text-primary font-mono font-bold">
                Started: {new Date(job.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {job.status === "Pending" && (
              <span className="text-amber-400 text-[10px] font-bold">Ready for Dispatch</span>
            )}
          </div>
        );

        return (
          <KanbanCard
            key={job.id}
            id={job.id}
            title={job.location || 'Site Location TBD'}
            subtitle={subtitle}
            badges={badges}
            details={details}
            metrics={metrics}
            customActions={customActions}
            draggable
            isDragging={draggedJobId === job.id}
            onDragStart={(e) => onDragStart(e, job.id)}
            onDragEnd={onDragEnd}
            onClick={() => onCardClick(job)}
            onMoveBack={() => onMoveBack(job.id)}
            onMoveForward={() => onMove(job.id)}
            onDelete={() => onDelete(job.id)}
            isAdmin={isAdmin}
            isFirstStage={isFirstStage}
            isLastStage={isLastStage}
            moveForwardIcon={stage === "In Transit" ? <Check size={13} /> : <ArrowRight size={13} />}
            moveForwardTitle={stage === "Pending" ? "Start Transit" : "Complete Delivery"}
          />
        );
      })}
    </KanbanColumn>
  );
}

export default function Logistics({ 
  jobs = [], 
  setJobs, 
  currentUser,
  customers = [],
  projects = [],
  invoices = [],
  partners = []
}) {
  const isAdmin = currentUser?.role === "Admin";
  const [activeSubTab, setActiveSubTab] = useState("delivery"); // Default to Delivery
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [aiSequence, setAiSequence] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);

  const [form, setForm] = useState({
    subType: "Finished Steel Frame",
    location: "",
    manifest: "",
    customer: "",
    customerPhone: "",
    clientNIC: "",
    driver: "Sunil (Driver)",
    vehicle: "Lorry (WP GE 1234)",
    linkedJobNo: "",
    priority: "Standard"
  });

  const [deletingJobId, setDeletingJobId] = useState(null);
  const [draggedJobId, setDraggedJobId] = useState(null);

  // Drag & Drop handlers
  const handleDragStart = (e, id) => {
    setDraggedJobId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedJobId(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetJobId, targetStage) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("text/plain") || draggedJobId;
    if (!jobId || jobId === targetJobId) return;

    const draggedJobIndex = jobs.findIndex((j) => j.id === jobId);
    if (draggedJobIndex === -1) return;

    const draggedJob = jobs[draggedJobIndex];
    let updatedJob = { ...draggedJob };

    if (draggedJob.status !== targetStage) {
      updatedJob.status = targetStage;
      if (targetStage === "In Transit") {
        updatedJob.startTime = new Date().toISOString();
      } else if (targetStage === "Completed") {
        const endTime = new Date();
        const startTime = draggedJob.startTime ? new Date(draggedJob.startTime) : endTime;
        const diffMs = endTime - startTime;
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.round((diffMs % 3600000) / 60000);
        updatedJob.endTime = endTime.toISOString();
        updatedJob.duration = `${hours}h ${mins}m`;
        toast.success(`${updatedJob.type} Task ${updatedJob.id} completed!`, {
          description: `Duration: ${hours}h ${mins}m`,
        });
      } else if (targetStage === "Pending") {
        updatedJob.startTime = null;
        updatedJob.endTime = null;
        updatedJob.duration = null;
      }
    }

    setJobs(prev => {
      const updatedJobsList = prev.filter((j) => j.id !== jobId);
      if (targetJobId) {
        const targetIndex = updatedJobsList.findIndex((j) => j.id === targetJobId);
        updatedJobsList.splice(targetIndex, 0, updatedJob);
      } else {
        updatedJobsList.push(updatedJob);
      }
      return updatedJobsList;
    });

    try {
      await updateDocument(COLLECTIONS.LOGISTICS, updatedJob._firestoreId || updatedJob.id, updatedJob);
    } catch(err) {
      console.error(err);
      toast.error("Failed to sync job stage change to database");
    }

    setDraggedJobId(null);
  };

  const callAIInsights = async (prompt) => {
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.text;
      }
    } catch (err) {
      console.error(err);
    }
    return "Kadawatha Hub -> Peliyagoda -> Central Colombo Route recommended for traffic efficiency.";
  };

  // Auto-fill form when linking an existing fabrication order
  const handleSelectFabricationJob = (jobNo) => {
    if (!jobNo) {
      setForm({ ...form, linkedJobNo: '' });
      return;
    }
    const proj = projects.find(p => p.jobNo === jobNo);
    if (!proj) return;

    // Look up customer phone
    const cust = customers.find(c => c.nic === proj.clientNIC || c.name === proj.customerName);

    setForm(prev => ({
      ...prev,
      linkedJobNo: jobNo,
      customer: proj.customerName || (cust?.type === 'Business' ? cust?.businessName : cust?.name) || prev.customer,
      customerPhone: proj.phone || cust?.phone || prev.customerPhone,
      location: proj.address || prev.location,
      subType: "Finished Steel Frame",
      manifest: `Delivery of order ${proj.jobNo}: ${proj.title || proj.scope || 'Custom steel frame'}`
    }));
    toast.success(`Loaded details from Work Order #${jobNo}`);
  };

  // Auto-fill form when picking a registered customer
  const handleSelectCustomer = (nic) => {
    const cust = customers.find(c => c.nic === nic);
    if (!cust) return;
    setForm(prev => ({
      ...prev,
      clientNIC: nic,
      customer: cust.type === 'Business' ? cust.businessName : cust.name,
      customerPhone: cust.phone || prev.customerPhone,
      location: cust.address || prev.location
    }));
  };

  const handleAddJob = async () => {
    if (!form.location) {
      toast.error("Please enter a destination or pickup address.");
      return;
    }
    const jobPrefix = activeSubTab === "pickup" ? "L-PK" : "L-DL";
    let jobId;
    try {
      jobId = await generateAtomicId(jobPrefix);
    } catch (err) {
      toast.error('Could not generate a job id, please try again: ' + err.message);
      return;
    }
    const newJob = {
      id: jobId,
      type: activeSubTab === "pickup" ? "Pickup" : "Delivery",
      subType: form.subType || (activeSubTab === "pickup" ? "Printed Canvas" : "Finished Steel Frame"),
      location: stripEmojis(form.location),
      customer: stripEmojis(form.customer) || "Direct Customer",
      customerPhone: form.customerPhone || "",
      status: "Pending",
      startTime: null,
      endTime: null,
      duration: null,
      manifest: stripEmojis(form.manifest),
      driver: form.driver || "Sunil (Driver)",
      vehicle: form.vehicle || "Lorry (WP GE 1234)",
      linkedJobNo: form.linkedJobNo || "",
      priority: form.priority || "Standard",
      notified: false,
      lastNotifiedAt: null,
      createdAt: new Date().toISOString()
    };

    setJobs([newJob, ...jobs]);
    setForm({
      subType: activeSubTab === "pickup" ? "Printed Canvas" : "Finished Steel Frame",
      location: "",
      manifest: "",
      customer: "",
      customerPhone: "",
      clientNIC: "",
      driver: "Sunil (Driver)",
      vehicle: "Lorry (WP GE 1234)",
      linkedJobNo: "",
      priority: "Standard"
    });
    setShowAddForm(false);
    
    try {
      await addDocument(COLLECTIONS.LOGISTICS, newJob, jobId);
      toast.success(`${newJob.type} Task ${jobId} scheduled!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync new task to DB");
    }
  };

  const handleMoveJob = async (id) => {
    let updatedJobObj = null;

    setJobs(prev => prev.map((job) => {
      if (job.id !== id) return job;
      const currentIdx = STAGES.indexOf(job.status);
      if (currentIdx === STAGES.length - 1) return job;
      const nextStatus = STAGES[currentIdx + 1];
      let updates = { status: nextStatus };
      if (nextStatus === "In Transit") {
        updates.startTime = new Date().toISOString();
        toast.info(`Task ${job.id} marked In Transit`);
      } else if (nextStatus === "Completed") {
        const endTime = new Date();
        const startTime = job.startTime ? new Date(job.startTime) : endTime;
        const diffMs = endTime - startTime;
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.round((diffMs % 3600000) / 60000);
        updates.endTime = endTime.toISOString();
        updates.duration = `${hours}h ${mins}m`;
        toast.success(`${job.type} Task ${job.id} completed!`, {
          description: `Duration: ${hours}h ${mins}m`,
        });
      }
      updatedJobObj = { ...job, ...updates };
      return updatedJobObj;
    }));

    if (updatedJobObj) {
      try {
        await updateDocument(COLLECTIONS.LOGISTICS, updatedJobObj._firestoreId || updatedJobObj.id, updatedJobObj);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleMoveJobBack = async (id) => {
    let updatedJobObj = null;

    setJobs(prev => prev.map((job) => {
      if (job.id !== id) return job;
      const currentIdx = STAGES.indexOf(job.status);
      if (currentIdx === 0) return job;
      const prevStatus = STAGES[currentIdx - 1];
      let updates = { status: prevStatus };
      if (prevStatus === "Pending") {
        updates.startTime = null;
      } else if (prevStatus === "In Transit") {
        updates.endTime = null;
        updates.duration = null;
      }
      updatedJobObj = { ...job, ...updates };
      return updatedJobObj;
    }));

    if (updatedJobObj) {
      try {
        await updateDocument(COLLECTIONS.LOGISTICS, updatedJobObj._firestoreId || updatedJobObj.id, updatedJobObj);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletingJobId) {
      const targetJob = jobs.find(j => j.id === deletingJobId);
      setJobs(prev => prev.filter((j) => j.id !== deletingJobId));
      setDeletingJobId(null);
      if (targetJob) {
        try {
          await deleteDocument(COLLECTIONS.LOGISTICS, targetJob._firestoreId || targetJob.id);
          toast.success("Task deleted successfully");
        } catch (err) {
          console.error(err);
          toast.error("Failed to delete task from DB");
        }
      }
    }
  };

  const handleOptimizeRoute = async () => {
    const locations = jobs
      .filter((j) => j.status === "Pending" && j.type.toLowerCase() === activeSubTab)
      .map((j) => j.location)
      .filter(Boolean)
      .join(", ");
    if (!locations) {
      setAiSequence(`No pending ${activeSubTab} locations to optimize.`);
      return;
    }
    setIsOptimizing(true);
    setAiSequence("");
    try {
      const prompt = `Kadawatha Central Hub is the starting point. Locations to visit for ${activeSubTab}: ${locations}. Suggest an efficient multi-stop route sequence for the driver.`;
      const result = await callAIInsights(prompt);
      setAiSequence(result);
    } catch {
      setAiSequence("Failed to optimize route sequence.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState('ALL');

  const baseJobs = jobs.filter((job) =>
    activeSubTab === "pickup" ? job.type === "Pickup" : job.type === "Delivery"
  );

  const filteredJobs = baseJobs.filter((job) => {
    const matchesSearch = !searchQuery ||
      (job.location && job.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.customer && job.customer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.id && job.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.linkedJobNo && job.linkedJobNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.driver && job.driver.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.subType && job.subType.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStage = filterStage === 'ALL' || job.status === filterStage;
    return matchesSearch && matchesStage;
  });

  const filterOptions = [
    { id: 'ALL', label: 'All Statuses', count: baseJobs.length },
    ...STAGES.map(stg => ({
      id: stg,
      label: stg,
      count: baseJobs.filter(j => j.status === stg).length
    }))
  ];

  const inTransitCount = baseJobs.filter(j => j.status === "In Transit").length;
  const pendingCount = baseJobs.filter(j => j.status === "Pending").length;

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      {/* Page Header */}
      <PageHeader
        title="Logistics & Fleet Dispatch"
        subtitle="Manage material pickups, customer frame deliveries, turn-by-turn navigation, and payment collection."
        metrics={[
          { label: "Active View", value: activeSubTab === "pickup" ? "Pickups" : "Deliveries", color: activeSubTab === "pickup" ? "primary" : "secondary" },
          { label: "In Transit", value: inTransitCount, color: inTransitCount > 0 ? "secondary" : "default" },
          { label: "Pending Run", value: pendingCount, color: pendingCount > 0 ? "amber" : "default" },
          { label: "Total Tasks", value: baseJobs.length, color: "default" }
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleOptimizeRoute}
              disabled={isOptimizing}
              className="flex items-center text-xs bg-primary/10 text-primary px-3.5 py-2.5 rounded-xl border border-primary/30 hover:bg-primary/20 disabled:opacity-50 transition-all font-bold active:scale-95 min-h-[44px]"
            >
              {isOptimizing ? (
                <Loader size={13} className="animate-spin mr-1.5" />
              ) : (
                <Navigation size={13} className="mr-1.5" />
              )}
              <span>{isOptimizing ? "Optimizing..." : "AI Route Sequence"}</span>
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className={`px-4 py-2.5 rounded-xl text-on-primary font-bold text-xs sm:text-sm transition-all flex items-center space-x-1.5 active:scale-95 shadow-[0_0_15px_rgba(0,218,243,0.2)] min-h-[44px] ${
                activeSubTab === "pickup"
                  ? "bg-primary text-on-primary hover:bg-primary/90"
                  : "bg-secondary text-on-secondary hover:bg-secondary/90"
              }`}
            >
              <Plus size={16} />
              <span>New {activeSubTab === "pickup" ? "Pickup" : "Delivery"}</span>
            </button>
          </div>
        }
      />

      {/* AI Sequence banner if generated */}
      {aiSequence && (
        <div className="mb-4 p-4 bg-surface-container border border-primary/40 rounded-xl text-xs text-on-surface shadow-[0_4px_20px_rgba(0,218,243,0.1)] relative font-medium">
          <div className="font-extrabold text-[10px] uppercase tracking-widest text-primary mb-1.5 flex items-center gap-1.5">
            <Navigation size={12} /> AI Recommended Multi-Stop Sequence:
          </div>
          <p className="text-on-surface-variant leading-relaxed">{aiSequence}</p>
          <button
            onClick={() => setAiSequence("")}
            className="absolute top-3 right-3 text-on-surface-variant hover:text-on-surface bg-surface-container-high rounded-full p-1 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Unified Filter Bar with Sub-Tab switcher */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search tasks by address, client, #PTF job, driver..."
        activeFilter={filterStage}
        onFilterChange={setFilterStage}
        filterOptions={filterOptions}
        totalCount={baseJobs.length}
        filteredCount={filteredJobs.length}
      >
        <div className="flex bg-surface-container-high p-1 rounded-lg border border-outline-variant/60 mr-2">
          <button
            onClick={() => { setActiveSubTab("pickup"); setFilterStage("ALL"); }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 min-h-[36px] ${
              activeSubTab === "pickup"
                ? "bg-primary text-on-primary shadow-[0_2px_8px_rgba(0,218,243,0.3)]"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Truck size={12} />
            <span>Pickups ({jobs.filter(j => j.type === "Pickup").length})</span>
          </button>
          <button
            onClick={() => { setActiveSubTab("delivery"); setFilterStage("ALL"); }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 min-h-[36px] ${
              activeSubTab === "delivery"
                ? "bg-secondary text-on-secondary shadow-[0_2px_8px_rgba(52,211,153,0.3)]"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <MapPin size={12} />
            <span>Deliveries ({jobs.filter(j => j.type === "Delivery").length})</span>
          </button>
        </div>
      </FilterBar>

      {/* Kanban Board Columns */}
      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory">
        <div className="flex space-x-3 sm:space-x-5 h-full min-w-max">
          {STAGES.filter(stage => filterStage === 'ALL' || filterStage === stage).map((stage) => {
            const originalIdx = STAGES.indexOf(stage);
            return (
              <LogisticsColumn
                key={stage}
                stage={stage}
                items={filteredJobs.filter((job) => job.status === stage)}
                onMove={handleMoveJob}
                onMoveBack={handleMoveJobBack}
                isFirstStage={originalIdx === 0}
                isLastStage={originalIdx === STAGES.length - 1}
                onAddNew={() => setShowAddForm(true)}
                isAdmin={isAdmin}
                onDelete={setDeletingJobId}
                onCardClick={setActiveJob}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                draggedJobId={draggedJobId}
                invoices={invoices}
              />
            );
          })}
        </div>
      </div>

      {/* Task Creation Modal with 1-Click Fabrication Order Link */}
      {showAddForm && (
        <ModalWrapper
          isOpen={showAddForm}
          onClose={() => setShowAddForm(false)}
          maxWidth="max-w-lg"
          height="h-auto max-h-[90vh]"
          ariaLabel={activeSubTab === "pickup" ? "New Pickup Task" : "New Delivery Task"}
        >
          <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center flex-shrink-0">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-on-surface">
                New {activeSubTab === "pickup" ? "Pickup Task" : "Delivery Task"}
              </h3>
              <p className="text-[10px] uppercase font-bold text-primary tracking-widest mt-0.5">
                Fleet Dispatch
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(false)}
              className="p-2 bg-surface-container-high text-on-surface-variant rounded-full hover:bg-surface-variant transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
            {/* Auto-fill from Fabrication Order Dropdown */}
            {activeSubTab === "delivery" && projects && projects.length > 0 && (
              <div className="p-3 bg-primary/10 rounded-xl border border-primary/25">
                <label className="block text-[10px] uppercase font-bold text-primary mb-1 tracking-wider">
                  Link Fabrication Work Order (Auto-fills Details)
                </label>
                <select
                  value={form.linkedJobNo}
                  onChange={(e) => handleSelectFabricationJob(e.target.value)}
                  className="w-full p-2.5 bg-surface-container border border-primary/30 rounded-xl text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">-- Choose Work Order to Deliver --</option>
                  {projects.map((p) => (
                    <option key={p.jobNo} value={p.jobNo}>
                      {p.jobNo} — {p.customerName || 'Client'} ({p.title || p.scope?.slice(0, 30) || 'Frame'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Select Customer */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                Select Customer / Client
              </label>
              <select
                value={form.clientNIC || ''}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-xs sm:text-sm font-semibold text-on-surface focus:ring-2 focus:ring-primary/50"
              >
                <option value="">-- Choose Registered Customer --</option>
                {customers?.map((c) => (
                  <option key={c.nic} value={c.nic}>
                    {c.type === "Business" ? String(c.businessName).toUpperCase() : c.name} ({c.phone || 'No phone'})
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Name input fallback */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                Customer / Consignee Name
              </label>
              <input
                type="text"
                value={form.customer}
                onChange={(e) => setForm({ ...form, customer: e.target.value })}
                className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
                placeholder="e.g. Gallery Wall / John Doe"
              />
            </div>

            {/* Customer Phone for 1-Tap calling */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                Customer Mobile Phone
              </label>
              <input
                type="tel"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface font-mono"
                placeholder="e.g. 0771234567"
              />
            </div>

            {/* Delivery / Site Address */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                Site / Delivery Address
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
                placeholder="e.g. Art Gallery, Colombo 07"
              />
            </div>

            {/* Cargo Category & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                  Cargo Category
                </label>
                <select
                  value={form.subType}
                  onChange={(e) => setForm({ ...form, subType: e.target.value })}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary/50 text-on-surface"
                >
                  {activeSubTab === "pickup" ? (
                    <>
                      <option value="Printed Canvas">Printed Canvas Roll</option>
                      <option value="Steel Supply">Steel Box Bar Supply</option>
                      <option value="Packaging Materials">Packaging Materials</option>
                    </>
                  ) : (
                    <>
                      <option value="Finished Steel Frame">Finished Gallery-Wrap Frame</option>
                      <option value="Client Sample">Steel Frame Sample</option>
                      <option value="Waste Return">Material Scrap Return</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary/50 text-on-surface"
                >
                  <option value="Standard">Standard</option>
                  <option value="Express">Express Rush</option>
                  <option value="Scheduled">Scheduled Drop-off</option>
                </select>
              </div>
            </div>

            {/* Driver & Vehicle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                  Assign Driver
                </label>
                <select
                  value={form.driver}
                  onChange={(e) => setForm({ ...form, driver: e.target.value })}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary/50 text-on-surface"
                >
                  {DRIVER_DIRECTORY.map(d => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                  Assign Vehicle
                </label>
                <select
                  value={form.vehicle}
                  onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary/50 text-on-surface"
                >
                  {FLEET_VEHICLES.map(v => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Manifest Notes */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                Manifest / Cargo Description
              </label>
              <input
                type="text"
                value={form.manifest}
                onChange={(e) => setForm({ ...form, manifest: e.target.value })}
                className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. 10x4ft box iron frame with canvas wrap"
              />
            </div>
          </div>

          <div className="p-4 sm:p-5 border-t border-outline-variant bg-surface-container-low flex justify-end space-x-3 flex-shrink-0">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-5 py-2.5 bg-surface-container-high text-on-surface rounded-xl font-bold text-xs hover:bg-surface-container-highest transition-colors border border-outline-variant/60"
            >
              Cancel
            </button>
            <button
              onClick={handleAddJob}
              disabled={!form.location}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,218,243,0.2)] active:scale-95 disabled:opacity-50"
            >
              Schedule Task
            </button>
          </div>
        </ModalWrapper>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={!!deletingJobId}
        onClose={() => setDeletingJobId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Logistics Task?"
        message={`Are you sure you want to permanently delete task "${deletingJobId}"? This will remove the route manifest and all tracking data.`}
      />

      {/* Detailed Road-Ready Drawer / Modal */}
      {activeJob && (
        <LogisticsCardDetails
          job={activeJob}
          onClose={() => setActiveJob(null)}
          onSave={async (updatedJob) => {
            setJobs(jobs.map((j) => j.id === updatedJob.id ? updatedJob : j));
            setActiveJob(null);
            try {
              await updateDocument(COLLECTIONS.LOGISTICS, updatedJob._firestoreId || updatedJob.id, updatedJob);
              toast.success(`Task ${updatedJob.id} updated`);
            } catch (err) {
              console.error(err);
              toast.error("Failed to update task in database");
            }
          }}
          invoices={invoices}
          customers={customers}
          projects={projects}
        />
      )}
    </div>
  );
}
