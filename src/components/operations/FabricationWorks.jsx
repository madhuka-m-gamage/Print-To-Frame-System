import React, { useState } from 'react';
import { 
  Hammer, 
  X, 
  Shield, 
  ShieldCheck,
  Check, 
  Clock, 
  Flag, 
  LayoutDashboard, 
  User, 
  Phone, 
  DollarSign, 
  Ruler, 
  MessageSquare, 
  Copy, 
  Loader, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  ArrowRight,
  Save,
  AlertCircle,
  AlertTriangle,
  Truck,
  UploadCloud,
  Paperclip,
  File,
  Scissors,
  Layers,
  Send,
  Sparkles
} from 'lucide-react';
import { toast } from '../../utils/toast';
import Card from '../common/Card';
import DeleteModal from '../common/DeleteModal';
import FrameBlueprintPreview from '../common/FrameBlueprintPreview';
import FabricationCardDetails from './FabricationCardDetails';
import { PageHeader, FilterBar, StatusBadge, KanbanColumn, KanbanCard, ModalWrapper } from '../common/ui';
import { addDocument, updateDocument, deleteDocument, COLLECTIONS, generateInvoiceId, generateAtomicId } from '../../services/firestoreSync';
import { stripEmojis, sanitizeTechnicalScope } from '../../utils/validation';
import { STEEL_PROFILES, calculateCutList, mmToFtIn } from '../../utils/cutListEngine';

const STAGES = ["Pending", "Ongoing", "Ready For Inspection", "Revision", "Completed"];

const STAGE_COLORS = {
  "Pending": "amber",
  "Ongoing": "primary",
  "Ready For Inspection": "primary",
  "Revision": "rose",
  "Completed": "emerald"
};

const getFabricationTitle = (job) => {
  if (!job) return "Fabrication Work";

  // 1. Explicit short title / item name if provided
  if (job.title && job.title.trim()) {
    return stripEmojis(job.title).trim();
  }
  if (job.itemName && job.itemName.trim()) {
    return stripEmojis(job.itemName).trim();
  }

  const scope = job.scope || "";

  // 2. Extract dimensions if available in mm or ft/inches
  let dimensionStr = "";
  if (job.frameWidth && job.frameHeight) {
    if (job.frameWidth >= 100 && job.frameHeight >= 100) {
      const wFt = Math.round(job.frameWidth / 304.8 * 10) / 10;
      const hFt = Math.round(job.frameHeight / 304.8 * 10) / 10;
      dimensionStr = `${wFt}' × ${hFt}'`;
    } else {
      dimensionStr = `${job.frameWidth} × ${job.frameHeight}`;
    }
  } else if (job.totalSqFt && Number(job.totalSqFt) > 0) {
    dimensionStr = `${job.totalSqFt} sq.ft`;
  }

  // 3. Search for structural keywords in scope
  const cleanScope = stripEmojis(scope.replace(/[*#_`]/g, ' ')).trim();
  const lowerScope = cleanScope.toLowerCase();

  const structures = [
    { match: 'box iron', label: 'Box Iron Frame' },
    { match: 'steel frame', label: 'Steel Tube Frame' },
    { match: 'light box', label: 'Light Box Structure' },
    { match: 'lightbox', label: 'Light Box Structure' },
    { match: 'signboard', label: 'Signboard Frame' },
    { match: 'hoarding', label: 'Hoarding Structure' },
    { match: 'canvas wrap', label: 'Gallery Canvas Wrap' },
    { match: 'gallery wrap', label: 'Gallery Canvas Wrap' },
    { match: 'gi pipe', label: 'GI Pipe Frame' },
    { match: 'truss', label: 'Steel Truss Work' },
    { match: 'banner', label: 'Banner Frame' },
    { match: 'mural', label: 'Wall Mural Frame' }
  ];

  let detectedType = "";
  for (const s of structures) {
    if (lowerScope.includes(s.match)) {
      detectedType = s.label;
      break;
    }
  }

  const dimRegex = /(\d+(?:\.\d+)?\s*(?:ft|'|m|mm|x|\*|by)\s*(?:x|\*|by)?\s*\d+(?:\.\d+)?\s*(?:ft|'|m|mm)?)/i;
  const matchDim = scope.match(dimRegex);
  if (!dimensionStr && matchDim) {
    dimensionStr = matchDim[1].replace(/\s+/g, ' ').trim();
  }

  if (detectedType && dimensionStr) {
    return `${detectedType} (${dimensionStr})`;
  }
  if (detectedType) {
    return detectedType;
  }
  if (dimensionStr) {
    return `Custom Frame (${dimensionStr})`;
  }

  // 4. Fallback: Parse first meaningful line
  const lines = cleanScope.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      !lower.startsWith('client') &&
      !lower.startsWith('phone') &&
      !lower.startsWith('email') &&
      !lower.startsWith('name:') &&
      !lower.startsWith('project:') &&
      !lower.startsWith('date') &&
      line.length > 2
    ) {
      const cleanLine = line.replace(/^(item\s*\d*:|item:|\d+\.|-|\*)\s*/i, '').trim();
      if (cleanLine) {
        return cleanLine.length > 35 ? cleanLine.slice(0, 35) + '...' : cleanLine;
      }
    }
  }

  return "Custom Steel Frame";
};

function FabricationColumn({
  stage,
  items,
  onMove,
  onMoveBack,
  isFirstStage,
  isLastStage,
  onClientUpdate,
  updatingJobId,
  isGeneratingUpdate,
  onCardClick,
  onAddNew,
  isAdmin,
  onDelete,
  onInspect,
  onSendToRevision,
  onDispatchLogistics
}) {
  return (
    <KanbanColumn
      title={stage}
      count={items.length}
      stageColor={STAGE_COLORS[stage] || "primary"}
      onAddNew={isFirstStage ? onAddNew : null}
      addNewText="Add Job"
    >
      {items.map((job) => {
        // Milestone completion count
        const milestonesDone = job.checklist ? Object.values(job.checklist).filter(Boolean).length : 0;

        const badges = (
          <>
            <span className="font-mono text-[10px] font-bold text-on-surface-variant tracking-wider">{job.jobNo}</span>
            {job.flexReceived ? (
              <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-md uppercase flex items-center border border-secondary/20">
                <Check size={10} className="mr-1" /> Canvas In
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md uppercase flex items-center border border-amber-400/20">
                <AlertCircle size={10} className="mr-1" /> Awaiting Canvas
              </span>
            )}
            {job.frameWidth && job.frameHeight ? (
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                {job.frameWidth}×{job.frameHeight} mm
              </span>
            ) : null}
            {job.status === "Revision" && job.defectDetails?.category ? (
              <span 
                className="text-[10px] font-bold text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-md uppercase flex items-center border border-rose-500/30"
                title={job.defectDetails.notes || job.defectDetails.category}
              >
                <AlertTriangle size={10} className="mr-1" /> {job.defectDetails.category}
              </span>
            ) : null}
            {milestonesDone > 0 && (
              <span className="text-[10px] font-medium text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md border border-outline-variant/50">
                {milestonesDone}/5 Steps
              </span>
            )}
          </>
        );

        const subtitle = (
          <span className="flex items-center text-xs text-on-surface-variant">
            <User size={12} className="mr-1 opacity-60" />
            <span className="truncate max-w-[150px]">{job.customerName || 'Walk-in Client'}</span>
          </span>
        );

        const details = (
          <div className="space-y-1.5 mb-2">
            <div className="flex items-center text-[10px] text-on-surface-variant">
              <Hammer size={11} className="mr-1.5 text-on-surface-variant flex-shrink-0" />
              <span className="truncate">
                {job.materials || (job.profileKey && STEEL_PROFILES[job.profileKey]?.label) || "Standard Steel Tube (1x1)"}
              </span>
            </div>
            {job.mountingType && (
              <div className="flex items-center text-[10px] text-on-surface-variant">
                <Flag size={11} className="mr-1.5 text-secondary flex-shrink-0" />
                <span className="truncate">Mount: {job.mountingType}</span>
              </div>
            )}
            {job.deadline && (
              <div className="flex items-center text-[10px] text-on-surface-variant">
                <Clock size={11} className="mr-1.5 text-primary/80 flex-shrink-0" />
                <span>
                  Target: <span className="font-bold text-on-surface">{job.deadline}</span>
                </span>
              </div>
            )}
            {job.dispatchedToLogistics && (
              <div className="flex items-center text-[10px] text-emerald-400 font-semibold">
                <Truck size={11} className="mr-1.5 text-emerald-400 flex-shrink-0" />
                <span>Dispatched to Logistics</span>
              </div>
            )}
          </div>
        );

        const customActions = (
          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
            {/* Quick Dispatch to Logistics Button (Completed) */}
            {stage === "Completed" && !job.dispatchedToLogistics && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDispatchLogistics(job);
                }}
                className="p-1.5 rounded-lg transition-all border bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30"
                title="Dispatch to Logistics Delivery"
              >
                <Truck size={13} />
              </button>
            )}

            {/* QA Inspection Gate Button (Ready For Inspection) */}
            {stage === "Ready For Inspection" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInspect(job);
                }}
                className="p-1.5 rounded-lg transition-all border bg-primary/15 text-primary hover:bg-primary/25 border-primary/30"
                title="Run QA Inspection Gate"
              >
                <ShieldCheck size={13} />
              </button>
            )}

            {/* Quick Send to Revision (Ongoing / Ready For Inspection) */}
            {(stage === "Ongoing" || stage === "Ready For Inspection") && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSendToRevision(job);
                }}
                className="p-1.5 rounded-lg transition-all border bg-surface-container-high text-on-surface-variant hover:text-rose-400 hover:bg-rose-500/10 border-outline-variant/60"
                title="Flag Defect / Send to Revision"
              >
                <AlertTriangle size={13} />
              </button>
            )}

            {/* WhatsApp AI Update */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClientUpdate(job);
              }}
              className={`p-1.5 rounded-lg transition-all border ${
                updatingJobId === job.jobNo 
                  ? "bg-primary text-on-primary border-primary" 
                  : "bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container border-outline-variant/60"
              }`}
              title="Generate AI WhatsApp Update"
            >
              {isGeneratingUpdate && updatingJobId === job.jobNo ? (
                <Loader size={13} className="animate-spin" />
              ) : (
                <MessageSquare size={13} />
              )}
            </button>
          </div>
        );

        let moveForwardTitle = "Advance Stage";
        let moveForwardIcon = <ArrowRight size={13} />;

        if (stage === "Ready For Inspection") {
          moveForwardTitle = "Run QA Inspection";
          moveForwardIcon = <ShieldCheck size={13} />;
        } else if (stage === "Revision") {
          moveForwardTitle = "Return to Inspection";
          moveForwardIcon = <Check size={13} />;
        }

        return (
          <KanbanCard
            key={job.jobNo}
            id={job.jobNo}
            title={getFabricationTitle(job)}
            subtitle={subtitle}
            badges={badges}
            details={details}
            customActions={customActions}
            onClick={() => onCardClick(job)}
            onMoveBack={() => onMoveBack(job.jobNo)}
            onMoveForward={() => onMove(job.jobNo)}
            onDelete={() => onDelete(job.jobNo)}
            isAdmin={isAdmin}
            isFirstStage={isFirstStage}
            isLastStage={isLastStage}
            moveForwardIcon={moveForwardIcon}
            moveForwardTitle={moveForwardTitle}
          />
        );
      })}
    </KanbanColumn>
  );
}

export default function FabricationWorks({ 
  projects = [], 
  setProjects, 
  customers, 
  partners, 
  currentUser,
  onSaveInvoice 
}) {
  const isAdmin = currentUser?.role === "Admin";
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeJob, setActiveJob] = useState(null);

  // Form for New Job Request
  const [form, setForm] = useState({
    title: "",
    clientNIC: "",
    customerNic: "",
    scope: "",
    status: "Pending",
    deadline: "",
    address: "",
    materials: "1.5\" × 1.5\" Box Iron",
    profileKey: "box_1_5",
    mountingType: "Flush Wall Mount",
    finishType: "Anti-Rust Red Oxide Primer",
    wrapStyle: "Gallery Wrap (1.5\" Edge)",
    note: "",
    assignee: "",
    flexReceived: false,
    value: 0,
    totalSqFt: 0,
    frameWidth: 900,
    frameHeight: 600,
    frameDepth: 45,
  });

  const [filterStage, setFilterStage] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingJobId, setDeletingJobId] = useState(null);

  // Client WhatsApp Update message state
  const [isGeneratingUpdate, setIsGeneratingUpdate] = useState(false);
  const [updatingJobId, setUpdatingJobId] = useState(null);
  const [whatsappUpdate, setWhatsappUpdate] = useState("");

  // QA Inspection Gate Modal state
  const [inspectingJob, setInspectingJob] = useState(null);
  // Closes the double-click race window on "Approve & Complete" — the modal
  // only closes (via setInspectingJob(null)) after the async invoice
  // generation/save completes, so a rapid second click before that could
  // otherwise trigger a second Final invoice for the same job.
  const [isApprovingQA, setIsApprovingQA] = useState(false);
  const [qaForm, setQaForm] = useState({
    squareness: true,
    welds: true,
    coating: true,
    canvasTension: true,
    inspector: currentUser?.name || "Lead Inspector",
    notes: ""
  });

  // Defect Tagging Modal state (for Revision)
  const [defectJob, setDefectJob] = useState(null);
  const [defectForm, setDefectForm] = useState({
    category: "Warped / Out of Square",
    notes: "",
    reporter: currentUser?.name || "Workshop QA"
  });

  // Handle Dimensions auto-updating total area in Add Form
  const handleDimensionChange = (field, val) => {
    const num = parseFloat(val) || 0;
    const nextForm = { ...form, [field]: num };
    if (nextForm.frameWidth > 0 && nextForm.frameHeight > 0) {
      const sqFt = Math.round((nextForm.frameWidth / 304.8) * (nextForm.frameHeight / 304.8) * 10) / 10;
      nextForm.totalSqFt = sqFt;
    }
    setForm(nextForm);
  };

  const handleAddNew = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!form.scope.trim() && !form.title.trim()) {
      toast.error("Please provide at least a title or brief scope for the fabrication job.");
      return;
    }
    const jobNo = `PTF-${String(Date.now()).slice(-4)}`;
    const now = new Date().toISOString();
    
    // Resolve customer info
    const custNic = form.customerNic || form.clientNIC || "";
    const custObj = customers?.find(c => c.nic === custNic);
    const custName = custObj ? (custObj.type === "Business" ? custObj.businessName : custObj.name) : "Direct Customer";

    // Auto-compute cut-list
    const initialCutList = calculateCutList({
      widthMm: Number(form.frameWidth) || 900,
      heightMm: Number(form.frameHeight) || 600,
      depthMm: Number(form.frameDepth) || 45,
      profileKey: form.profileKey || 'box_1_5'
    });

    const newJob = {
      jobNo: jobNo,
      title: form.title || `${STEEL_PROFILES[form.profileKey]?.label || 'Box Iron'} Frame (${mmToFtIn(form.frameWidth)} × ${mmToFtIn(form.frameHeight)})`,
      clientNIC: custNic || "Direct Customer",
      customerNic: custNic,
      customerName: custName,
      scope: sanitizeTechnicalScope(form.scope) || `${STEEL_PROFILES[form.profileKey]?.label || '1.5" Box Iron'} Frame (${form.frameWidth}×${form.frameHeight}mm) with ${form.finishType}, ${form.mountingType}`,
      status: "Pending",
      stageEnteredAt: now,
      deadline: form.deadline || now.split("T")[0],
      address: stripEmojis(form.address) || "Pickup at Colombo Hub",
      materials: form.materials || (STEEL_PROFILES[form.profileKey]?.label) || "1.5\" × 1.5\" Box Iron",
      profileKey: form.profileKey || 'box_1_5',
      mountingType: form.mountingType || 'Flush Wall Mount',
      finishType: form.finishType || 'Anti-Rust Red Oxide Primer',
      wrapStyle: form.wrapStyle || 'Gallery Wrap (1.5" Edge)',
      note: form.note || "",
      assignee: form.assignee || "",
      flexReceived: form.flexReceived || false,
      value: Number(form.value) || 0,
      totalSqFt: Number(form.totalSqFt) || Math.round((Number(form.frameWidth) / 304.8) * (Number(form.frameHeight) / 304.8) * 10) / 10,
      frameWidth: Number(form.frameWidth) || 900,
      frameHeight: Number(form.frameHeight) || 600,
      frameDepth: Number(form.frameDepth) || 45,
      cutList: initialCutList,
      checklist: {
        materialsCut: false,
        frameWelded: false,
        primerApplied: false,
        canvasWrapped: form.flexReceived || false,
        qaPassed: false,
      },
      createdAt: now,
    };

    setProjects([newJob, ...projects]);
    setShowAddForm(false);
    setForm({
      title: "",
      clientNIC: "",
      customerNic: "",
      scope: "",
      status: "Pending",
      deadline: "",
      address: "",
      materials: "1.5\" × 1.5\" Box Iron",
      profileKey: "box_1_5",
      mountingType: "Flush Wall Mount",
      finishType: "Anti-Rust Red Oxide Primer",
      wrapStyle: "Gallery Wrap (1.5\" Edge)",
      note: "",
      assignee: "",
      flexReceived: false,
      value: 0,
      totalSqFt: 0,
      frameWidth: 900,
      frameHeight: 600,
      frameDepth: 45,
    });
    
    try {
      await addDocument(COLLECTIONS.PROJECTS, newJob, jobNo);
      toast.success(`Job ${jobNo} queued to production floor`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync new fabrication job to DB");
    }
  };

  // Dispatch Completed Job to Logistics Delivery
  const handleDispatchToLogistics = async (job) => {
    let deliveryId;
    try {
      deliveryId = await generateAtomicId('L-DL');
    } catch (err) {
      toast.error('Could not generate a delivery id, please try again: ' + err.message);
      return;
    }
    const cust = customers?.find(c => c.nic === (job.clientNIC || job.customerNic));
    const custName = cust?.name || cust?.businessName || job.customerName || "Direct Customer";
    
    const logisticsTask = {
      id: deliveryId,
      type: "Delivery",
      subType: "Finished Steel Frame",
      location: job.address || "Colombo Hub Delivery",
      customer: custName,
      status: "Pending",
      startTime: null,
      endTime: null,
      duration: null,
      manifest: `Delivery of finished fabrication job ${job.jobNo}: ${getFabricationTitle(job)}`,
      driver: "",
      vehicle: "",
      notified: false,
      lastNotifiedAt: null,
      linkedJobNo: job.jobNo,
      createdAt: new Date().toISOString()
    };

    try {
      await addDocument(COLLECTIONS.LOGISTICS, logisticsTask, deliveryId);
      const updatedJob = { ...job, dispatchedToLogistics: true, logisticsTaskId: deliveryId };
      setProjects(projects.map(p => p.jobNo === job.jobNo ? updatedJob : p));
      await updateDocument(COLLECTIONS.PROJECTS, job._firestoreId || job.jobNo, { 
        dispatchedToLogistics: true, 
        logisticsTaskId: deliveryId 
      });
      toast.success(`Job ${job.jobNo} dispatched to Logistics!`, {
        description: `Delivery Task ${deliveryId} scheduled.`
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to create Logistics delivery task: " + err.message);
    }
  };

  // Step Job Forward in the Kanban
  const handleMoveJob = async (jobNo) => {
    const jobBeingMoved = projects.find(j => j.jobNo === jobNo);
    if (!jobBeingMoved) return;

    const currentStatus = jobBeingMoved.status || "Pending";

    // Gate: "Ready For Inspection" requires QA inspection dialog before moving to "Completed"
    if (currentStatus === "Ready For Inspection") {
      setInspectingJob(jobBeingMoved);
      setQaForm({
        squareness: true,
        welds: true,
        coating: true,
        canvasTension: true,
        inspector: currentUser?.name || "Lead Inspector",
        notes: ""
      });
      return;
    }

    // Gate: "Revision" moving forward goes back to "Ready For Inspection"
    if (currentStatus === "Revision") {
      const now = new Date().toISOString();
      const updatedJobObj = { 
        ...jobBeingMoved, 
        status: "Ready For Inspection", 
        stageEnteredAt: now,
        reworkCompletedAt: now
      };
      setProjects(projects.map(j => j.jobNo === jobNo ? updatedJobObj : j));
      try {
        await updateDocument(COLLECTIONS.PROJECTS, jobBeingMoved._firestoreId || jobBeingMoved.jobNo, updatedJobObj);
        toast.success(`Job ${jobNo} rework completed, ready for QA re-inspection.`);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    let nextStatusStr = null;
    const now = new Date().toISOString();
    const currentIdx = STAGES.indexOf(currentStatus);

    if (currentStatus === "Pending") nextStatusStr = "Ongoing";
    else if (currentStatus === "Ongoing") nextStatusStr = "Ready For Inspection";
    else if (currentIdx < STAGES.length - 1) nextStatusStr = STAGES[currentIdx + 1];

    if (!nextStatusStr) return;

    const updatedJobObj = { ...jobBeingMoved, status: nextStatusStr, stageEnteredAt: now };
    setProjects(projects.map(j => j.jobNo === jobNo ? updatedJobObj : j));

    try {
      await updateDocument(COLLECTIONS.PROJECTS, updatedJobObj._firestoreId || updatedJobObj.jobNo, updatedJobObj);
      toast.success(`Job ${jobNo} moved to ${nextStatusStr}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Step Job Back in the Kanban
  const handleMoveJobBack = async (jobNo) => {
    const jobBeingMoved = projects.find(j => j.jobNo === jobNo);
    if (!jobBeingMoved) return;

    const currentStatus = jobBeingMoved.status || "Pending";
    let prevStatusStr = null;

    if (currentStatus === "Ongoing") prevStatusStr = "Pending";
    else if (currentStatus === "Ready For Inspection") prevStatusStr = "Ongoing";
    else if (currentStatus === "Revision") prevStatusStr = "Ongoing";
    else if (currentStatus === "Completed") prevStatusStr = "Ready For Inspection";

    if (!prevStatusStr) return;

    const updatedJobObj = { ...jobBeingMoved, status: prevStatusStr };
    setProjects(projects.map(j => j.jobNo === jobNo ? updatedJobObj : j));

    try {
      await updateDocument(COLLECTIONS.PROJECTS, updatedJobObj._firestoreId || updatedJobObj.jobNo, updatedJobObj);
      toast.info(`Job ${jobNo} moved back to ${prevStatusStr}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Confirm QA Passed & Mark as Completed
  const handlePassQA = async () => {
    if (!inspectingJob || isApprovingQA) return;
    // The 4-point checklist must actually gate this action — previously
    // every checkbox was recorded but never checked, so a job could be
    // approved and invoiced with every point left unchecked (representing
    // a failed inspection). Use "Fail & Send to Revision" for anything
    // that didn't pass all four.
    if (!qaForm.squareness || !qaForm.welds || !qaForm.coating || !qaForm.canvasTension) {
      toast.error('All 4 QA checks must pass before approving — use "Fail & Send to Revision" instead.');
      return;
    }
    setIsApprovingQA(true);
    try {
      await handlePassQAInner();
    } finally {
      setIsApprovingQA(false);
    }
  };

  const handlePassQAInner = async () => {
    const targetJob = inspectingJob;
    const now = new Date().toISOString();

    let finalInvId = null;
    const needsInvoice = onSaveInvoice && (Number(targetJob.value) || 0) > 0;
    if (needsInvoice) {
      try {
        finalInvId = await generateInvoiceId('Final');
      } catch (err) {
        // Never mark a billable job Completed without its invoice — that
        // would silently lose the 25% Final Settlement with no later
        // mechanism to backfill it.
        toast.error('Could not generate the Final invoice number, so this job was NOT marked Completed. Please try again: ' + err.message);
        return;
      }
    }

    const updatedJobObj = {
      ...targetJob,
      status: "Completed",
      stageEnteredAt: now,
      checklist: {
        ...(targetJob.checklist || {}),
        qaPassed: true
      },
      qaCheck: {
        passed: true,
        inspector: qaForm.inspector || currentUser?.name || "Lead Inspector",
        inspectedAt: now,
        notes: qaForm.notes || "All 4 QA inspection points verified",
        checks: {
          squareness: qaForm.squareness,
          welds: qaForm.welds,
          coating: qaForm.coating,
          canvasTension: qaForm.canvasTension
        }
      }
    };

    // Auto-generate 25% Final Settlement Invoice if applicable
    if (needsInvoice) {
      const cust = customers?.find(c => c.nic === (targetJob.clientNIC || targetJob.customerNic));
      const custName = cust?.name || cust?.businessName || targetJob.customerName || "Direct Customer";

      onSaveInvoice({
        id: finalInvId,
        linkedJobNo: targetJob.jobNo,
        jobNo: targetJob.jobNo,
        // Propagate every id alias the job carries, not just leadId — a
        // fabrication job dispatched from a Lead/Deal may only carry
        // dealId/originalLeadId/convertedDealId (manually-created shop-floor
        // jobs carry none of these, and stay unlinked, which is expected).
        // Stamping only leadId orphaned the invoice from lead/deal-based
        // lookups (matchesEntity, the commission logic in App.jsx, the
        // Payment Status panel) whenever a job's identity lived in one of
        // the other fields.
        leadId: targetJob.leadId || '',
        dealId: targetJob.dealId || '',
        originalLeadId: targetJob.originalLeadId || '',
        convertedDealId: targetJob.convertedDealId || '',
        customerName: custName,
        company: cust?.businessName || "",
        phone: targetJob.phone || cust?.phone || "",
        date: now.split("T")[0],
        amount: (Number(targetJob.value) || 0) * 0.25,
        totalValue: Number(targetJob.value) || 0,
        type: 'Final',
        status: 'Unpaid',
        aiDraft: `Final Settlement (25% Balance) upon QA pass of ${targetJob.jobNo} — ${targetJob.scope || 'Custom steel framing'}.`,
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      });

      toast.success(`Job ${targetJob.jobNo} Completed!`, {
        description: '25% Final Settlement Invoice generated in Invoices.'
      });
    } else {
      toast.success(`Job ${targetJob.jobNo} passed QA and marked Completed!`);
    }

    setProjects(projects.map(p => p.jobNo === targetJob.jobNo ? updatedJobObj : p));
    setInspectingJob(null);

    try {
      await updateDocument(COLLECTIONS.PROJECTS, targetJob._firestoreId || targetJob.jobNo, updatedJobObj);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update project status in DB");
    }
  };

  // Confirm Defect & Send Job to Revision
  const handleConfirmRevision = async () => {
    if (!defectJob) return;
    const targetJob = defectJob;
    const now = new Date().toISOString();

    const updatedJobObj = {
      ...targetJob,
      status: "Revision",
      stageEnteredAt: now,
      checklist: {
        ...(targetJob.checklist || {}),
        qaPassed: false
      },
      defectDetails: {
        category: defectForm.category,
        notes: defectForm.notes || "Revision required before completion.",
        reportedAt: now,
        reporter: defectForm.reporter || currentUser?.name || "Workshop QA"
      }
    };

    setProjects(projects.map(p => p.jobNo === targetJob.jobNo ? updatedJobObj : p));
    setDefectJob(null);

    try {
      await updateDocument(COLLECTIONS.PROJECTS, targetJob._firestoreId || targetJob.jobNo, updatedJobObj);
      toast.error(`Job ${targetJob.jobNo} moved to Revision: ${defectForm.category}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync revision status to DB");
    }
  };

  const handleGenerateUpdate = async (job) => {
    if (updatingJobId === job.jobNo && whatsappUpdate) {
      setUpdatingJobId(null);
      setWhatsappUpdate("");
      return;
    }
    setUpdatingJobId(job.jobNo);
    setWhatsappUpdate("");
    setIsGeneratingUpdate(true);
    try {
      const prompt = `Draft a highly professional, polite WhatsApp update for "Print To Frame". Customer: ${job.customerName}, Job: ${job.jobNo} (${job.scope}), Status: ${job.status}. Deadline: ${job.deadline}. Make it friendly.`;
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (response.ok) {
        const data = await response.json();
        setWhatsappUpdate(data.text);
      } else {
        setWhatsappUpdate("Failed to generate update. Check API connection.");
      }
    } catch {
      setWhatsappUpdate("Failed to generate update. Please try again.");
    } finally {
      setIsGeneratingUpdate(false);
    }
  };

  const handleSaveJobUpdates = async (updatedJob) => {
    setProjects(projects.map((p) => (p.jobNo === updatedJob.jobNo ? updatedJob : p)));
    setActiveJob(null);
    try {
      await updateDocument(COLLECTIONS.PROJECTS, updatedJob._firestoreId || updatedJob.jobNo, updatedJob);
      toast.success(`Job ${updatedJob.jobNo} updated`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync project updates");
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletingJobId) {
      const targetJob = projects.find((p) => p.jobNo === deletingJobId);
      setProjects(projects.filter((p) => p.jobNo !== deletingJobId));
      setDeletingJobId(null);
      if (targetJob) {
        try {
          await deleteDocument(COLLECTIONS.PROJECTS, targetJob._firestoreId || targetJob.jobNo);
          toast.success("Fabrication job deleted successfully");
        } catch (err) {
          console.error(err);
          toast.error("Failed to delete fabrication job from DB");
        }
      }
    }
  };

  const filteredProjects = projects.filter((job) => {
    const title = getFabricationTitle(job);
    const matchesSearch = !searchQuery ||
      (job.jobNo && job.jobNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.customerName && job.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.title && job.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (title && title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.materials && job.materials.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.scope && job.scope.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.deadline && job.deadline.toLowerCase().includes(searchQuery.toLowerCase()));
    const jobStage = job.status || "Pending";
    const matchesStage = filterStage === 'ALL' || jobStage === filterStage;
    return matchesSearch && matchesStage;
  });

  const filterOptions = [
    { id: 'ALL', label: 'All Jobs', count: projects.length },
    ...STAGES.map(stg => ({
      id: stg,
      label: stg,
      count: projects.filter(p => (p.status || "Pending") === stg).length
    }))
  ];

  const ongoingCount = projects.filter(p => p.status === "Ongoing").length;
  const readyCount = projects.filter(p => p.status === "Ready For Inspection").length;
  const revisionCount = projects.filter(p => p.status === "Revision").length;

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      {/* Unified Page Header */}
      <PageHeader
        title="Fabrication Works"
        subtitle="Manage workshop manufacturing from raw steel cut-lists to gallery wraps and QA signoffs."
        metrics={[
          { label: "Ongoing", value: ongoingCount, color: "primary" },
          { label: "Ready Inspection", value: readyCount, color: readyCount > 0 ? "secondary" : "default" },
          { label: "In Revision", value: revisionCount, color: revisionCount > 0 ? "rose" : "default" },
          { label: "Total Active", value: projects.length, color: "default" }
        ]}
        actions={
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 flex items-center space-x-1.5 shadow-[0_0_15px_rgba(0,218,243,0.2)]"
          >
            <Hammer size={16} />
            <span>New Job Request</span>
          </button>
        }
      />

      {/* AI WhatsApp Draft banner if active */}
      {whatsappUpdate && updatingJobId && (
        <div className="mb-4 p-4 bg-surface-container border border-primary/40 rounded-2xl shadow-[0_4px_20px_rgba(0,218,243,0.1)] relative max-w-2xl animate-in fade-in slide-in-from-top-1 duration-300 font-medium">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] uppercase font-bold text-primary tracking-widest flex items-center">
              <MessageSquare size={12} className="mr-1.5" /> AI WhatsApp Update Draft
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(whatsappUpdate);
                  toast.success("Update copied to clipboard!");
                }}
                className="p-1.5 bg-surface-container-high rounded-lg text-primary hover:bg-primary/10 border border-primary/20 transition-all active:scale-95"
                title="Copy to clipboard"
              >
                <Copy size={15} />
              </button>
              <button
                onClick={() => {
                  setUpdatingJobId(null);
                  setWhatsappUpdate("");
                }}
                className="p-1.5 bg-surface-container-high rounded-lg text-on-surface-variant hover:text-on-surface border border-outline-variant/50 transition-all"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>
          <p className="text-xs text-on-surface whitespace-pre-wrap leading-relaxed italic border-l-2 border-primary/40 pl-3 py-1 bg-surface-container-low/50 rounded-r-lg">
            {whatsappUpdate}
          </p>
        </div>
      )}

      {/* Unified Filter Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search jobs by #ID, client, materials, scope..."
        activeFilter={filterStage}
        onFilterChange={setFilterStage}
        filterOptions={filterOptions}
        totalCount={projects.length}
        filteredCount={filteredProjects.length}
      />

      {/* Kanban Board Columns */}
      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory">
        <div className="flex space-x-3 sm:space-x-5 h-full min-w-max">
          {STAGES.filter(stage => filterStage === 'ALL' || filterStage === stage).map((stage) => {
            const originalIdx = STAGES.indexOf(stage);
            return (
              <FabricationColumn
                key={stage}
                stage={stage}
                items={filteredProjects.filter((p) => (p.status || "Pending") === stage)}
                onMove={handleMoveJob}
                onMoveBack={handleMoveJobBack}
                isFirstStage={originalIdx === 0}
                isLastStage={originalIdx === STAGES.length - 1}
                onClientUpdate={handleGenerateUpdate}
                updatingJobId={updatingJobId}
                isGeneratingUpdate={isGeneratingUpdate}
                onCardClick={setActiveJob}
                onAddNew={() => setShowAddForm(true)}
                isAdmin={isAdmin}
                onDelete={setDeletingJobId}
                onInspect={(job) => {
                  setInspectingJob(job);
                  setQaForm({
                    squareness: true,
                    welds: true,
                    coating: true,
                    canvasTension: true,
                    inspector: currentUser?.name || "Lead Inspector",
                    notes: ""
                  });
                }}
                onSendToRevision={(job) => {
                  setDefectJob(job);
                  setDefectForm({
                    category: "Warped / Out of Square",
                    notes: "",
                    reporter: currentUser?.name || "Workshop QA"
                  });
                }}
                onDispatchLogistics={handleDispatchToLogistics}
              />
            );
          })}
        </div>
      </div>

      {/* Detailed Fabrication Card Drawer / Modal */}
      {activeJob && (
        <FabricationCardDetails
          job={activeJob}
          onClose={() => setActiveJob(null)}
          onSave={handleSaveJobUpdates}
          customers={customers}
        />
      )}

      {/* QA Inspection Gate Modal */}
      {inspectingJob && (
        <ModalWrapper
          isOpen={!!inspectingJob}
          onClose={() => setInspectingJob(null)}
          maxWidth="max-w-xl"
          ariaLabel="Quality Assurance Inspection Gate"
        >
          <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-on-surface">QA Inspection Gate</h3>
                <p className="text-[11px] text-primary font-mono font-bold tracking-wider">
                  {inspectingJob.jobNo} — {getFabricationTitle(inspectingJob)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setInspectingJob(null)}
              className="p-1.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Target Squareness specification banner */}
            {inspectingJob.frameWidth && inspectingJob.frameHeight ? (
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                    Corner Squareness Target
                  </span>
                  <span className="font-mono text-sm font-bold text-primary">
                    D = {Math.round(Math.sqrt(Math.pow(Number(inspectingJob.frameWidth), 2) + Math.pow(Number(inspectingJob.frameHeight), 2)))} mm
                  </span>
                  <span className="text-[10px] text-on-surface-variant ml-2">(Diagonals within ±2mm)</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-surface-container-high rounded-md text-on-surface">
                  {inspectingJob.frameWidth} × {inspectingJob.frameHeight} mm
                </span>
              </div>
            ) : null}

            {/* 4-Point Interactive QA Checklist */}
            <div className="space-y-2.5">
              <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest block">
                Mandatory Quality Checkpoints
              </label>
              
              <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                qaForm.squareness ? "bg-primary/10 border-primary/40 text-on-surface" : "bg-surface-container-low border-outline-variant/60 text-on-surface-variant"
              }`}>
                <input
                  type="checkbox"
                  checked={qaForm.squareness}
                  onChange={(e) => setQaForm({ ...qaForm, squareness: e.target.checked })}
                  className="mt-0.5 rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
                />
                <div className="text-xs">
                  <span className="font-bold text-on-surface block">1. Corner Squareness & Planarity</span>
                  <span className="text-on-surface-variant text-[11px]">Both corner diagonals match within 2mm; no frame twist or warp.</span>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                qaForm.welds ? "bg-primary/10 border-primary/40 text-on-surface" : "bg-surface-container-low border-outline-variant/60 text-on-surface-variant"
              }`}>
                <input
                  type="checkbox"
                  checked={qaForm.welds}
                  onChange={(e) => setQaForm({ ...qaForm, welds: e.target.checked })}
                  className="mt-0.5 rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
                />
                <div className="text-xs">
                  <span className="font-bold text-on-surface block">2. Weld Penetration & Flush Grind</span>
                  <span className="text-on-surface-variant text-[11px]">Continuous weld seams; weld spatter chipped clean; outer faces ground flush.</span>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                qaForm.coating ? "bg-primary/10 border-primary/40 text-on-surface" : "bg-surface-container-low border-outline-variant/60 text-on-surface-variant"
              }`}>
                <input
                  type="checkbox"
                  checked={qaForm.coating}
                  onChange={(e) => setQaForm({ ...qaForm, coating: e.target.checked })}
                  className="mt-0.5 rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
                />
                <div className="text-xs">
                  <span className="font-bold text-on-surface block">3. Anti-Rust Primer & Finish Quality</span>
                  <span className="text-on-surface-variant text-[11px]">Even coating across tubes and ground welds; zero exposed steel or drips.</span>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                qaForm.canvasTension ? "bg-primary/10 border-primary/40 text-on-surface" : "bg-surface-container-low border-outline-variant/60 text-on-surface-variant"
              }`}>
                <input
                  type="checkbox"
                  checked={qaForm.canvasTension}
                  onChange={(e) => setQaForm({ ...qaForm, canvasTension: e.target.checked })}
                  className="mt-0.5 rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
                />
                <div className="text-xs">
                  <span className="font-bold text-on-surface block">4. Canvas Tension & Clean Wrap</span>
                  <span className="text-on-surface-variant text-[11px]">Drum-tight stretch without puckers; square alignment; neat folded corners.</span>
                </div>
              </label>
            </div>

            {/* Inspector info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block mb-1">
                  Inspector Name
                </label>
                <input
                  type="text"
                  value={qaForm.inspector}
                  onChange={(e) => setQaForm({ ...qaForm, inspector: e.target.value })}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Inspector Name"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block mb-1">
                  Inspection Remarks
                </label>
                <input
                  type="text"
                  value={qaForm.notes}
                  onChange={(e) => setQaForm({ ...qaForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. Dimensions verified; ready for packaging"
                />
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 border-t border-outline-variant bg-surface-container-low flex items-center justify-between flex-shrink-0">
            <button
              onClick={() => {
                const target = inspectingJob;
                setInspectingJob(null);
                setDefectJob(target);
                setDefectForm({
                  category: "Warped / Out of Square",
                  notes: qaForm.notes || "",
                  reporter: qaForm.inspector || currentUser?.name || "QA Inspector"
                });
              }}
              className="px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl font-bold text-xs flex items-center transition-all"
            >
              <AlertTriangle size={14} className="mr-1.5" />
              <span>Fail & Send to Revision</span>
            </button>

            <div className="flex space-x-2">
              <button
                onClick={() => setInspectingJob(null)}
                className="px-4 py-2 bg-surface-container-high text-on-surface-variant rounded-xl font-bold text-xs hover:bg-surface-container-highest border border-outline-variant/60"
              >
                Cancel
              </button>
              <button
                onClick={handlePassQA}
                disabled={isApprovingQA || !qaForm.squareness || !qaForm.welds || !qaForm.coating || !qaForm.canvasTension}
                title={!qaForm.squareness || !qaForm.welds || !qaForm.coating || !qaForm.canvasTension ? 'All 4 QA checks must pass first' : undefined}
                className="px-5 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs hover:bg-emerald-600 transition-all flex items-center shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500 disabled:active:scale-100"
              >
                <Check size={14} className="mr-1.5" />
                <span>{isApprovingQA ? 'Approving...' : 'Approve & Complete'}</span>
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* Defect Tagging Modal (for Revision) */}
      {defectJob && (
        <ModalWrapper
          isOpen={!!defectJob}
          onClose={() => setDefectJob(null)}
          maxWidth="max-w-lg"
          ariaLabel="Defect Tagging & Workshop Revision"
        >
          <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-on-surface">Flag Defect for Revision</h3>
                <p className="text-[11px] text-rose-400 font-mono font-bold tracking-wider">
                  {defectJob.jobNo} — {getFabricationTitle(defectJob)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDefectJob(null)}
              className="p-1.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
            <div>
              <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest block mb-2">
                Defect Category
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: "Warped / Out of Square", desc: "Diagonals diff > 2mm or twisted plane" },
                  { label: "Dimensional Mismatch", desc: "Dimensions differ from client spec" },
                  { label: "Weld Defect / Porosity", desc: "Incomplete weld or rough corners" },
                  { label: "Primer / Paint Flaw", desc: "Bare metal spots, runs or drips" },
                  { label: "Canvas Sag / Creasing", desc: "Loose stretch tension or puckers" },
                  { label: "Material Damage", desc: "Dented profile or scratched face" }
                ].map(def => (
                  <button
                    key={def.label}
                    type="button"
                    onClick={() => setDefectForm({ ...defectForm, category: def.label })}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      defectForm.category === def.label
                        ? "bg-rose-500/15 border-rose-500 text-on-surface shadow-sm"
                        : "bg-surface-container-low border-outline-variant/60 text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    <div className="font-bold text-xs text-on-surface flex items-center justify-between">
                      <span>{def.label}</span>
                      {defectForm.category === def.label && <Check size={12} className="text-rose-400" />}
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 line-clamp-1">{def.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest block mb-1">
                Rework Instructions & Location
              </label>
              <textarea
                rows={3}
                value={defectForm.notes}
                onChange={(e) => setDefectForm({ ...defectForm, notes: e.target.value })}
                className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                placeholder="e.g. Cut weld on top-left joint, re-clamp to 90 degrees and re-weld. Apply red oxide touch-up."
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest block mb-1">
                Reported By
              </label>
              <input
                type="text"
                value={defectForm.reporter}
                onChange={(e) => setDefectForm({ ...defectForm, reporter: e.target.value })}
                className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                placeholder="Workshop Inspector"
              />
            </div>
          </div>

          <div className="p-4 sm:p-5 border-t border-outline-variant bg-surface-container-low flex justify-end space-x-2 flex-shrink-0">
            <button
              onClick={() => setDefectJob(null)}
              className="px-4 py-2 bg-surface-container-high text-on-surface-variant rounded-xl font-bold text-xs hover:bg-surface-container-highest border border-outline-variant/60"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmRevision}
              className="px-5 py-2 bg-rose-500 text-white rounded-xl font-bold text-xs hover:bg-rose-600 transition-all flex items-center shadow-[0_0_15px_rgba(244,63,94,0.3)] active:scale-95"
            >
              <AlertTriangle size={14} className="mr-1.5" />
              <span>Confirm Revision Order</span>
            </button>
          </div>
        </ModalWrapper>
      )}

      {/* New Job Request Modal */}
      {showAddForm && (
        <ModalWrapper
          isOpen={showAddForm}
          onClose={() => setShowAddForm(false)}
          maxWidth="max-w-2xl"
          height="h-[90vh] max-h-[850px]"
          ariaLabel="New Custom Framing Job"
        >
          <div className="px-6 py-5 border-b border-outline-variant bg-surface-container-low flex justify-between items-center flex-shrink-0">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-on-surface">New Custom Framing Job</h3>
              <p className="text-[10px] uppercase font-bold text-primary tracking-widest mt-0.5">
                Specialist Steel Work Order
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(false)}
              className="p-2 bg-surface-container-high text-on-surface-variant rounded-full hover:bg-surface-variant transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
            {/* Printed Canvas In-Hand Toggle */}
            <div
              className="bg-primary/10 p-4 rounded-2xl border border-primary/20 flex items-center justify-between group cursor-pointer hover:bg-primary/15 transition-all shadow-inner"
              onClick={() => setForm({ ...form, flexReceived: !form.flexReceived })}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-xl transition-all ${form.flexReceived ? "bg-secondary text-on-secondary shadow-md" : "bg-surface-container text-on-surface-variant border border-outline-variant"}`}>
                  <Paperclip size={18} />
                </div>
                <div>
                  <span className="block text-sm font-extrabold text-on-surface">Printed Canvas In-Hand?</span>
                  <span className="block text-[10px] text-primary font-medium">
                    Auto-triggers canvas wrap phase if fabric is already received at workshop
                  </span>
                </div>
              </div>
              {form.flexReceived && <Check className="text-secondary" size={20} />}
            </div>

            {/* Client & Assignee */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-2 tracking-widest">
                  Select Customer
                </label>
                <select
                  value={form.customerNic}
                  onChange={(e) => setForm({ ...form, customerNic: e.target.value, clientNIC: e.target.value })}
                  className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none bg-surface-container font-medium text-on-surface"
                >
                  <option value="">-- Choose Client --</option>
                  {customers?.map((c) => (
                    <option key={c.nic} value={c.nic}>
                      {c.type === "Business" ? String(c.businessName).toUpperCase() : c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-2 tracking-widest">
                  Assigned Fabricator
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-3.5 text-on-surface-variant" />
                  <input
                    type="text"
                    value={form.assignee}
                    onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                    className="w-full pl-9 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
                    placeholder="e.g. Saman / Kamal"
                  />
                </div>
              </div>
            </div>

            {/* Item Title */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-2 tracking-widest">
                Work Order Item Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-semibold text-on-surface"
                placeholder="e.g. Box Iron Frame (10' × 4') or Light Box Signboard"
              />
            </div>

            {/* Structural Specification: Steel Profile, Mounting, Finish */}
            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/60 space-y-4">
              <span className="text-[10px] uppercase font-bold text-primary tracking-widest block">
                Framing Engineering Specifications
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                    Steel Profile
                  </label>
                  <select
                    value={form.profileKey}
                    onChange={(e) => {
                      const key = e.target.value;
                      setForm({
                        ...form,
                        profileKey: key,
                        materials: STEEL_PROFILES[key]?.label || form.materials
                      });
                    }}
                    className="w-full p-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary/50"
                  >
                    {Object.entries(STEEL_PROFILES).map(([key, p]) => (
                      <option key={key} value={key}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                    Mounting Type
                  </label>
                  <select
                    value={form.mountingType}
                    onChange={(e) => setForm({ ...form, mountingType: e.target.value })}
                    className="w-full p-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="Flush Wall Mount">Flush Wall Mount</option>
                    <option value="Hanging Eyelets">Hanging Eyelets</option>
                    <option value="Freestanding Base">Freestanding Base</option>
                    <option value="Truss Clamp">Truss Clamp</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                    Finish / Coating
                  </label>
                  <select
                    value={form.finishType}
                    onChange={(e) => setForm({ ...form, finishType: e.target.value })}
                    className="w-full p-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="Anti-Rust Red Oxide Primer">Anti-Rust Red Oxide</option>
                    <option value="Matt Black Enamel">Matt Black Enamel</option>
                    <option value="Gloss White Paint">Gloss White Paint</option>
                    <option value="Galvanized Zinc Spray">Galvanized Zinc Spray</option>
                  </select>
                </div>
              </div>

              {/* Exact Dimensions: Width, Height, Depth in mm */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                    Width (mm)
                  </label>
                  <input
                    type="number"
                    value={form.frameWidth}
                    onChange={(e) => handleDimensionChange('frameWidth', e.target.value)}
                    className="w-full p-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-mono font-bold text-on-surface focus:ring-2 focus:ring-primary/50"
                    placeholder="900"
                  />
                  <span className="text-[10px] text-primary font-medium mt-0.5 block">
                    ≈ {mmToFtIn(form.frameWidth)}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                    Height (mm)
                  </label>
                  <input
                    type="number"
                    value={form.frameHeight}
                    onChange={(e) => handleDimensionChange('frameHeight', e.target.value)}
                    className="w-full p-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-mono font-bold text-on-surface focus:ring-2 focus:ring-primary/50"
                    placeholder="600"
                  />
                  <span className="text-[10px] text-primary font-medium mt-0.5 block">
                    ≈ {mmToFtIn(form.frameHeight)}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                    Depth (mm)
                  </label>
                  <input
                    type="number"
                    value={form.frameDepth}
                    onChange={(e) => setForm({ ...form, frameDepth: parseFloat(e.target.value) || 45 })}
                    className="w-full p-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-mono font-bold text-on-surface focus:ring-2 focus:ring-primary/50"
                    placeholder="45"
                  />
                  <span className="text-[10px] text-on-surface-variant font-medium mt-0.5 block">
                    Area: {form.totalSqFt || 0} sq.ft
                  </span>
                </div>
              </div>
            </div>

            {/* Scope description */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-2 tracking-widest">
                Detailed Scope & Notes
              </label>
              <textarea
                rows={2}
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
                className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
                placeholder="e.g. 1.5 inch Box Iron frame with intermediate stiffeners, red oxide primer and flush wall brackets."
              />
            </div>

            {/* Deadline and Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-2 tracking-widest">
                  Deadline
                </label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-2 tracking-widest">
                  Installation / Delivery Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
                  placeholder="e.g. Colombo 07"
                />
              </div>
            </div>

            {/* Value and Area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                  Total Job Value (LKR)
                </label>
                <input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
                  className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
                  placeholder="e.g. 150000"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                  Total Area (SqFt)
                </label>
                <input
                  type="number"
                  value={form.totalSqFt}
                  onChange={(e) => setForm({ ...form, totalSqFt: parseFloat(e.target.value) || 0 })}
                  className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
                  placeholder="e.g. 45"
                />
              </div>
            </div>

            {/* QA Instructions */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-2 tracking-widest">
                Workshop Special Instructions
              </label>
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="w-full p-3 bg-error/10 border border-error/30 rounded-xl text-sm italic text-on-surface focus:outline-none focus:ring-2 focus:ring-error/50"
                placeholder="Special welding or mounting precautions..."
              />
            </div>
          </div>

          <div className="p-4 sm:p-6 border-t border-outline-variant bg-surface-container-low flex justify-end space-x-3 flex-shrink-0">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-5 py-2.5 bg-surface-container-high text-on-surface rounded-xl font-bold text-xs hover:bg-surface-container-highest transition-colors border border-outline-variant/60"
            >
              Cancel
            </button>
            <button
              onClick={handleAddNew}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,218,243,0.2)] active:scale-95"
            >
              Generate Work Order
            </button>
          </div>
        </ModalWrapper>
      )}

      {/* Permanent Delete Modal */}
      <DeleteModal
        isOpen={!!deletingJobId}
        onClose={() => setDeletingJobId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Work Order?"
        message={`Are you sure you want to permanently delete job "${deletingJobId}"? This will stop all manufacturing and logistics tracking for this specific order.`}
      />
    </div>
  );
}
