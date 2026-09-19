import React, { useState, useMemo } from 'react';
import { 
  Hammer, 
  User, 
  DollarSign, 
  Ruler, 
  Clock, 
  Check, 
  AlertCircle, 
  FileText, 
  Paperclip, 
  UploadCloud, 
  File, 
  Save, 
  Printer,
  ShieldCheck,
  X,
  Layers,
  Scissors,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Compass,
  Package
} from 'lucide-react';
import FrameBlueprintPreview from '../common/FrameBlueprintPreview';
import { 
  DetailModalLayout, 
  DetailModalHeader, 
  DetailModalContent, 
  DetailModalSidebar, 
  DetailFieldGroup, 
  DetailCustomerCard, 
  DetailModalFooter,
  StatusBadge 
} from '../common/ui';
import { toast } from '../../utils/toast';
import { stripEmojis, sanitizeTechnicalScope } from '../../utils/validation';
import { calculateCutList, mmToFtIn, STEEL_PROFILES } from '../../utils/cutListEngine';

export default function FabricationCardDetails({ 
  job, 
  onClose, 
  onSave, 
  customers = [] 
}) {
  const [unitMode, setUnitMode] = useState('mm'); // 'mm' | 'ft'

  const [form, setForm] = useState({
    title: job.title || '',
    materials: job.materials || '1.5" × 1.5" Box Iron',
    profileKey: job.profileKey || 'box_1_5',
    mountingType: job.mountingType || 'Flush Wall Mount',
    finishType: job.finishType || 'Anti-Rust Red Oxide Primer',
    wrapStyle: job.wrapStyle || 'Gallery Wrap (1.5" Edge)',
    note: job.note || '',
    assignee: job.assignee || '',
    flexReceived: job.flexReceived || false,
    blueprints: job.blueprints || [],
    frameWidth: job.frameWidth || (job.totalSqFt ? Math.round(Math.sqrt(job.totalSqFt * 144) * 25.4) : 900),
    frameHeight: job.frameHeight || (job.totalSqFt ? Math.round(Math.sqrt(job.totalSqFt * 144) * 25.4 * 0.67) : 600),
    frameDepth: job.frameDepth || 45,
    checklist: {
      materialsCut: job.checklist?.materialsCut || false,
      frameWelded: job.checklist?.frameWelded || false,
      primerApplied: job.checklist?.primerApplied || false,
      canvasWrapped: job.checklist?.canvasWrapped || job.flexReceived || false,
      qaPassed: job.checklist?.qaPassed || false,
    }
  });

  const [isDragging, setIsDragging] = useState(false);

  // Compute live Cut-List & BOM
  const cutList = useMemo(() => {
    return calculateCutList({
      widthMm: Number(form.frameWidth) || 900,
      heightMm: Number(form.frameHeight) || 600,
      depthMm: Number(form.frameDepth) || 45,
      profileKey: form.profileKey || 'box_1_5'
    });
  }, [form.frameWidth, form.frameHeight, form.frameDepth, form.profileKey]);

  // Checkbox micro-milestone completion count
  const completedMilestonesCount = useMemo(() => {
    return Object.values(form.checklist).filter(Boolean).length;
  }, [form.checklist]);

  const handleToggleMilestone = (key) => {
    setForm(prev => {
      const updatedChecklist = {
        ...prev.checklist,
        [key]: !prev.checklist[key]
      };
      // Keep flexReceived in sync with canvasWrapped
      const flexUpdated = key === 'canvasWrapped' ? updatedChecklist.canvasWrapped : prev.flexReceived;
      return {
        ...prev,
        flexReceived: flexUpdated,
        checklist: updatedChecklist
      };
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  const handleFiles = (files) => {
    const validFiles = files.filter(f => f.type.includes('image') || f.type.includes('pdf'));
    Promise.all(validFiles.map(f => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            name: f.name,
            type: f.type,
            size: f.size,
            data: e.target.result
          });
        };
        reader.readAsDataURL(f);
      });
    })).then(newFiles => {
      setForm(prev => ({
        ...prev,
        blueprints: [...prev.blueprints, ...newFiles]
      }));
      toast.success(`${newFiles.length} file(s) attached successfully!`);
    });
  };

  const removeBlueprint = (index) => {
    setForm(prev => ({
      ...prev,
      blueprints: prev.blueprints.filter((_, i) => i !== index)
    }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => {
      if (name === 'flexReceived') {
        return {
          ...prev,
          flexReceived: checked,
          checklist: { ...prev.checklist, canvasWrapped: checked }
        };
      }
      return {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
    });
  };

  const handleSave = () => {
    onSave({
      ...job,
      ...form,
      frameWidth: Number(form.frameWidth) || 900,
      frameHeight: Number(form.frameHeight) || 600,
      frameDepth: Number(form.frameDepth) || 45,
      materials: STEEL_PROFILES[form.profileKey]?.label || form.materials,
      scope: sanitizeTechnicalScope(job.scope || "")
    });
    toast.success("Fabrication production details & cut-list saved!");
    onClose();
  };

  const client = customers.find(c => c.nic === job.customerNic || c.nic === job.clientNIC);
  const clientName = client?.name || client?.businessName || job.customerName || "Direct Customer";
  const clientPhone = client?.phone || job.phone || "N/A";
  const clientNic = client?.nic || job.customerNic || job.clientNIC || "N/A";

  // High-Precision Single-Page A4 Workshop Ticket Print
  const printWorkOrder = () => {
    const dateStr = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(`https://portal.print2frame.xyz/?tab=projects&jobId=${job.jobNo}`)}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fabrication Work Order — ${job.jobNo}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
            @page { size: A4 portrait; margin: 12mm 15mm; }
            body { font-family: 'Outfit', sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 11pt; line-height: 1.3; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #00daf3; padding-bottom: 10px; margin-bottom: 12px; }
            .badge { background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-size: 9pt; font-weight: 800; text-transform: uppercase; }
            .section { margin-top: 12px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #cbd5e1; }
            .section-title { font-size: 9pt; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; }
            .mono { font-family: 'JetBrains Mono', monospace; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.5pt; }
            th, td { padding: 6px 8px; border-bottom: 1px solid #cbd5e1; text-align: left; }
            th { background: #e2e8f0; font-weight: 800; font-size: 8.5pt; text-transform: uppercase; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
            .highlight-box { background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 6px; padding: 8px 12px; }
            .checkbox-square { width: 14px; height: 14px; border: 1.5px solid #475569; display: inline-block; vertical-align: middle; border-radius: 2px; }
            .qr-block { text-align: right; }
            .qr-block img { width: 75px; height: 75px; border: 1px solid #cbd5e1; padding: 2px; border-radius: 4px; }
            .sig-block { margin-top: 25px; display: flex; justify-content: space-between; border-top: 1px dashed #94a3b8; padding-top: 15px; }
            .sig-line { width: 180px; border-bottom: 1px solid #475569; margin-top: 25px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 style="margin:0; font-size: 18pt; font-weight:800; color:#0f172a; letter-spacing:-0.5px;">PRINT TO FRAME — WORKSHOP JOB TICKET</h1>
              <p style="margin:2px 0 0 0; color:#475569; font-size:9.5pt; font-weight:600;">Custom Steel Fabrication & Gallery Framing Division</p>
              <p style="margin:2px 0 0 0; color:#64748b; font-size:8.5pt;">Item: <strong>${form.title || 'Custom Steel Frame'}</strong></p>
            </div>
            <div class="qr-block">
              <img src="${qrUrl}" alt="Job QR Code" />
              <div class="mono" style="font-size:11pt; font-weight:800; margin-top:2px;">${job.jobNo}</div>
              <div style="font-size:8pt; color:#64748b;">Scan for digital ticket</div>
            </div>
          </div>

          <div class="grid-2">
            <div class="section">
              <div class="section-title">Client & Logistics Information</div>
              <p style="margin:0; font-weight:800; font-size:11pt;">${clientName}</p>
              <p style="margin:3px 0 0 0; font-size:9pt; color:#334155;">NIC: <span class="mono">${clientNic}</span> | Phone: <span class="mono">${clientPhone}</span></p>
              <p style="margin:3px 0 0 0; font-size:9pt; color:#334155;">Delivery: <strong>${job.address || 'Pickup at Colombo / Kadawatha Hub'}</strong></p>
            </div>

            <div class="section">
              <div class="section-title">Production Targets & Readiness</div>
              <div class="grid-2" style="font-size:9pt;">
                <div>Target Deadline: <strong style="color:#0f172a;">${job.deadline || 'TBA'}</strong></div>
                <div>Stage: <span class="badge">${job.status || 'Pending'}</span></div>
                <div>Assignee: <strong>${form.assignee || 'Unassigned'}</strong></div>
                <div>Canvas In-Hand: <strong>${form.flexReceived ? '✓ Yes, Received' : '⏳ Awaiting Component'}</strong></div>
              </div>
            </div>
          </div>

          <!-- Technical Steel Frame Cut List -->
          <div class="section">
            <div class="section-title">
              <span>Automated Steel Cut-List (${cutList.profile.label})</span>
              <span class="mono" style="color:#0369a1; font-size:8.5pt;">Total Bars: ${cutList.summary.standardStockBars} × 20ft (${cutList.summary.grossLengthMeters}m gross)</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width:10%;">Mark</th>
                  <th style="width:38%;">Piece Description</th>
                  <th style="width:18%;">Length (mm)</th>
                  <th style="width:14%;">Length (ft/in)</th>
                  <th style="width:12%;">Cut Angle</th>
                  <th style="width:8%; text-align:center;">Cut?</th>
                </tr>
              </thead>
              <tbody>
                ${cutList.cutItems.map(item => `
                  <tr>
                    <td class="mono" style="font-weight:800;">${item.mark}</td>
                    <td>${item.description}</td>
                    <td class="mono" style="font-weight:700;">${item.lengthMm} mm</td>
                    <td class="mono" style="color:#475569;">${item.lengthFtIn}</td>
                    <td style="font-size:8.5pt; font-weight:600; color:#0369a1;">${item.cutType}</td>
                    <td style="text-align:center;"><span class="checkbox-square"></span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Squareness & Welding Verification Targets -->
          <div class="grid-2" style="margin-top:10px;">
            <div class="highlight-box">
              <div style="font-size:8.5pt; font-weight:800; text-transform:uppercase; color:#0891b2; letter-spacing:0.05em;">
                Critical Squaring Target (Check Tape Diagonal)
              </div>
              <div class="mono" style="font-size:14pt; font-weight:800; color:#0e7490; margin-top:2px;">
                D₁ = D₂ = ${cutList.dimensions.diagonalMm} mm (${cutList.dimensions.diagonalFtIn})
              </div>
              <div style="font-size:8pt; color:#475569; margin-top:2px;">
                *Tolerance: ±2mm. Both diagonal corner measurements must match exactly before full welding.
              </div>
            </div>

            <div class="section" style="margin-top:0;">
              <div class="section-title">Hardware & Finish Specifications</div>
              <div style="font-size:8.5pt; line-height:1.4;">
                <div>Mounting: <strong>${form.mountingType}</strong></div>
                <div>Coating: <strong>${form.finishType}</strong></div>
                <div>Wrapping: <strong>${form.wrapStyle}</strong></div>
                <div>Gussets: <strong>4 × 75mm Mild Steel Corner Plates</strong></div>
              </div>
            </div>
          </div>

          <!-- Scope & Quality Notes -->
          <div class="section" style="margin-top:10px;">
            <div class="section-title">Technical Scope & Workshop Instructions</div>
            <div style="font-size:8.5pt; line-height:1.4; color:#1e293b; white-space:pre-wrap; font-family:monospace;">${stripEmojis(job.scope) || 'Custom steel gallery wrap frame fabrication.'}</div>
            ${form.note ? `
              <div style="margin-top:6px; font-size:8.5pt; color:#b45309; font-weight:bold; border-left:3px solid #f59e0b; padding-left:8px;">
                Note: ${form.note}
              </div>
            ` : ''}
          </div>

          <!-- Sign-Off Block -->
          <div class="sig-block">
            <div>
              <div style="font-size:8.5pt; color:#475569; font-weight:bold;">1. Fabricator / Welder Sign-Off</div>
              <div style="font-size:8pt; color:#64748b;">Cuts verified & frame squared</div>
              <div class="sig-line"></div>
            </div>
            <div>
              <div style="font-size:8.5pt; color:#475569; font-weight:bold;">2. Anti-Rust & Canvas Sign-Off</div>
              <div style="font-size:8pt; color:#64748b;">Welds ground, primer coated & stretched</div>
              <div class="sig-line"></div>
            </div>
            <div>
              <div style="font-size:8.5pt; color:#475569; font-weight:bold;">3. Final QA Inspector Sign-Off</div>
              <div style="font-size:8pt; color:#64748b;">Passed inspection & approved for dispatch</div>
              <div class="sig-line"></div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const printWin = window.open('', '', 'height=850,width=850');
    printWin.document.write(html);
    printWin.document.close();
  };

  return (
    <DetailModalLayout isOpen={true} onClose={onClose} ariaLabel="Fabrication Work Order">
      
      {/* Universal Header with Progress & Dual Unit Switcher */}
      <DetailModalHeader
        title={form.title || `Fabrication: ${job.jobNo}`}
        id={job.jobNo}
        badge={
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status || "Pending"} size="sm" />
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              {completedMilestonesCount}/5 Steps
            </span>
          </div>
        }
        subtitle={
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span>Client: <strong className="text-on-surface">{clientName}</strong></span>
            <span>•</span>
            <span className={form.flexReceived ? "text-status-success-on font-bold" : "text-status-warning-on font-bold"}>
              {form.flexReceived ? "✓ Canvas In-Hand" : "⏳ Awaiting Canvas"}
            </span>
            <span>•</span>
            <span className="font-mono text-on-surface-variant font-bold">
              {form.frameWidth} × {form.frameHeight} mm ({mmToFtIn(form.frameWidth)} × {mmToFtIn(form.frameHeight)})
            </span>
          </div>
        }
        onClose={onClose}
      />

      {/* Main 2-Column Responsive Body */}
      <div className="flex-1 overflow-y-auto lg:grid lg:grid-cols-[1fr_430px] custom-scrollbar">
        
        {/* Left Column: Technical Specifications, CAD Blueprint, Automated Cut-List */}
        <DetailModalContent>
          
          {/* Work Order Title & Structured Framing Attributes */}
          <DetailFieldGroup label="Work Order Title & Specifications" icon={FileText}>
            <div>
              <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                Item Title (Kanban Display Heading)
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Box Iron Frame (10' × 4')"
                className="w-full p-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Technical Framing Specifications Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                  Steel Tube Profile
                </label>
                <select
                  name="profileKey"
                  value={form.profileKey}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {Object.values(STEEL_PROFILES).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                  Mounting / Anchoring Type
                </label>
                <select
                  name="mountingType"
                  value={form.mountingType}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="Flush Wall Mount">Flush Wall Mount (Keyhole Brackets)</option>
                  <option value="Standoff Brackets">Standoff Brackets (2-inch clearance)</option>
                  <option value="Hanging Hooks">Heavy-Duty Hanging Eyelets</option>
                  <option value="Freestanding Base">Freestanding Steel Baseplate</option>
                  <option value="Site Bolted">Site-Bolted Structural Anchors</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                  Coating & Finish
                </label>
                <select
                  name="finishType"
                  value={form.finishType}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="Anti-Rust Red Oxide Primer">Anti-Rust Red Oxide Primer</option>
                  <option value="Zinc Phosphate Grey Primer">Zinc Phosphate Grey Primer</option>
                  <option value="Matte Black Enamel Finish">Matte Black Enamel Finish</option>
                  <option value="Gloss White Enamel Finish">Gloss White Enamel Finish</option>
                  <option value="Hot-Dip Galvanized Bare">Hot-Dip Galvanized Bare</option>
                  <option value="Black Powder Coating">Industrial Powder Coated</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 tracking-wider">
                  Gallery Wrap Depth & Style
                </label>
                <select
                  name="wrapStyle"
                  value={form.wrapStyle}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="Gallery Wrap (1.5 inch Edge)">Gallery Wrap (1.5" Edge)</option>
                  <option value="Deep Wrap (2.0 inch Edge)">Deep Wrap (2.0" Edge)</option>
                  <option value="Frameless Face Stretch">Frameless Face Stretch</option>
                  <option value="Face-Riveted / Border Bead">Face-Riveted / Border Bead</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                Full Technical Scope & Requirements
              </label>
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline text-xs text-on-surface leading-relaxed font-medium whitespace-pre-wrap font-mono max-h-32 overflow-y-auto custom-scrollbar">
                {stripEmojis(job.scope) || "Custom steel framing and gallery canvas wrap fabrication."}
              </div>
            </div>
          </DetailFieldGroup>

          {/* Automated Shop-Floor Cut-List & BOM Engine */}
          <DetailFieldGroup 
            label="Automated Steel Cut-List & Cutting Schedule" 
            icon={Scissors}
            action={
              <div className="flex items-center gap-1.5 bg-surface-container px-2 py-1 rounded-lg border border-outline text-[11px] font-bold">
                <span className="text-on-surface-variant text-[10px] uppercase">Unit:</span>
                <button
                  type="button"
                  onClick={() => setUnitMode('mm')}
                  className={`px-2 py-0.5 rounded transition-all ${unitMode === 'mm' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  MM
                </button>
                <button
                  type="button"
                  onClick={() => setUnitMode('ft')}
                  className={`px-2 py-0.5 rounded transition-all ${unitMode === 'ft' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  FT / IN
                </button>
              </div>
            }
          >
            {/* Squaring Verification Callout */}
            <div className="p-3.5 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary text-on-primary rounded-xl shrink-0">
                  <Compass size={18} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-extrabold text-primary tracking-wider block">
                    Critical Squareness Target (Corner Diagonals)
                  </span>
                  <span className="text-sm font-mono font-black text-on-surface">
                    D₁ = D₂ = {cutList.dimensions.diagonalMm} mm ({cutList.dimensions.diagonalFtIn})
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded bg-surface-container border border-outline text-on-surface-variant shrink-0">
                Tolerance: ±2mm
              </span>
            </div>

            {/* Cut-List Table */}
            <div className="overflow-x-auto rounded-xl border border-outline bg-surface-container-low">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container-high/80 border-b border-outline text-[10px] uppercase font-extrabold text-on-surface-variant">
                    <th className="py-2.5 px-3">Mark</th>
                    <th className="py-2.5 px-3">Piece Description</th>
                    <th className="py-2.5 px-3">Cut Type</th>
                    <th className="py-2.5 px-3 text-right">Length</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/40 font-mono">
                  {cutList.cutItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-container-highest/30 transition-colors">
                      <td className="py-2 px-3 font-black text-primary">{item.mark}</td>
                      <td className="py-2 px-3 font-sans text-on-surface font-semibold text-xs">
                        {item.description}
                        {item.note && <span className="block text-[10px] text-on-surface-variant font-mono">{item.note}</span>}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-status-info-on font-sans font-bold">
                        {item.cutType}
                      </td>
                      <td className="py-2 px-3 text-right font-black text-on-surface">
                        {unitMode === 'mm' ? `${item.lengthMm} mm` : item.lengthFtIn}
                        <span className="block text-[9px] text-on-surface-variant font-normal">
                          {unitMode === 'mm' ? item.lengthFtIn : `${item.lengthMm} mm`}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-black text-primary">
                        ×{item.qty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Material Requisition Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-2.5 bg-surface-container-low rounded-xl border border-outline">
                <span className="text-[9px] uppercase font-bold text-on-surface-variant block tracking-wider">20ft Stock Bars</span>
                <span className="text-sm font-mono font-black text-primary mt-0.5 block">
                  {cutList.summary.standardStockBars} Bars
                </span>
                <span className="text-[9px] text-on-surface-variant block">Req from Store</span>
              </div>

              <div className="p-2.5 bg-surface-container-low rounded-xl border border-outline">
                <span className="text-[9px] uppercase font-bold text-on-surface-variant block tracking-wider">Total Steel</span>
                <span className="text-sm font-mono font-black text-on-surface mt-0.5 block">
                  {cutList.summary.grossLengthMeters} m
                </span>
                <span className="text-[9px] text-on-surface-variant block">{cutList.summary.grossLengthFeet} Feet</span>
              </div>

              <div className="p-2.5 bg-surface-container-low rounded-xl border border-outline">
                <span className="text-[9px] uppercase font-bold text-on-surface-variant block tracking-wider">Corner Gussets</span>
                <span className="text-sm font-mono font-black text-on-surface mt-0.5 block">
                  4 Plates
                </span>
                <span className="text-[9px] text-on-surface-variant block">75mm Triangular</span>
              </div>

              <div className="p-2.5 bg-surface-container-low rounded-xl border border-outline">
                <span className="text-[9px] uppercase font-bold text-on-surface-variant block tracking-wider">Estimated Weight</span>
                <span className="text-sm font-mono font-black text-on-surface mt-0.5 block">
                  ~{cutList.summary.estimatedWeightKg} kg
                </span>
                <span className="text-[9px] text-on-surface-variant block">Mild Steel</span>
              </div>
            </div>
          </DetailFieldGroup>

          {/* Interactive CAD Structural Blueprint with Dimension Tuners */}
          <DetailFieldGroup label="Interactive CAD Structural Blueprint" icon={Ruler}>
            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline">
              <FrameBlueprintPreview
                width={Number(form.frameWidth) || 900}
                height={Number(form.frameHeight) || 600}
                depth={Number(form.frameDepth) || 45}
                material={STEEL_PROFILES[form.profileKey]?.label || 'Box Iron'}
                unit="mm"
                showDimensions={true}
              />
              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-outline">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-on-surface-variant mb-1">
                    Width (mm)
                  </label>
                  <input
                    type="number"
                    name="frameWidth"
                    value={form.frameWidth}
                    onChange={handleChange}
                    className="w-full p-2 bg-surface-container-highest/60 border border-outline rounded-lg text-xs font-mono text-on-surface font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-[9px] font-mono text-on-surface-variant block mt-0.5">
                    ≈ {mmToFtIn(form.frameWidth)}
                  </span>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-on-surface-variant mb-1">
                    Height (mm)
                  </label>
                  <input
                    type="number"
                    name="frameHeight"
                    value={form.frameHeight}
                    onChange={handleChange}
                    className="w-full p-2 bg-surface-container-highest/60 border border-outline rounded-lg text-xs font-mono text-on-surface font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-[9px] font-mono text-on-surface-variant block mt-0.5">
                    ≈ {mmToFtIn(form.frameHeight)}
                  </span>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-on-surface-variant mb-1">
                    Depth (mm)
                  </label>
                  <input
                    type="number"
                    name="frameDepth"
                    value={form.frameDepth}
                    onChange={handleChange}
                    className="w-full p-2 bg-surface-container-highest/60 border border-outline rounded-lg text-xs font-mono text-on-surface font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-[9px] font-mono text-on-surface-variant block mt-0.5">
                    ≈ {Math.round(form.frameDepth / 25.4 * 10) / 10}" profile
                  </span>
                </div>
              </div>
            </div>
          </DetailFieldGroup>

          {/* Technical Blueprints & Attachments */}
          <DetailFieldGroup label="Technical Blueprints & Attachments" icon={Paperclip}>
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer relative group ${
                isDragging 
                  ? 'border-primary bg-primary/10' 
                  : 'border-outline hover:bg-surface-container-low hover:border-primary/50'
              }`}
            >
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <UploadCloud size={24} className="mx-auto text-primary mb-1.5 opacity-80 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-on-surface block">
                Upload CAD Drawing, Sketch, or Cut Sheet
              </span>
              <span className="text-[10px] text-on-surface-variant mt-0.5 block">
                Drag and drop PDF / PNG / JPEG up to 10MB
              </span>
            </div>

            {form.blueprints.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {form.blueprints.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-surface-container-low rounded-lg border border-outline">
                    <div className="flex items-center space-x-2 overflow-hidden">
                      <File size={14} className="text-primary shrink-0" />
                      <span className="text-xs font-medium text-on-surface truncate" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBlueprint(idx)}
                      className="p-1 text-on-surface-variant hover:text-error transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </DetailFieldGroup>

        </DetailModalContent>

        {/* Right Column: Customer Card, Micro-Milestones Checklist, Financials, QA Notes */}
        <DetailModalSidebar>
          
          {/* Customer Profile Widget */}
          <DetailFieldGroup label="Ordered By (Client Profile)" icon={User}>
            <DetailCustomerCard
              customerName={clientName}
              phone={clientPhone}
              company={client?.company || client?.businessName}
              photoURL={client?.photoURL || client?.avatar}
              address={job.address || client?.address || "Pickup at Kadawatha Hub"}
            />
          </DetailFieldGroup>

          {/* Shop-Floor Micro-Milestones Checklist */}
          <DetailFieldGroup 
            label="Shop-Floor Fabrication Milestones" 
            icon={CheckCircle2}
            badge={
              <span className="text-[10px] font-bold text-primary">
                {completedMilestonesCount}/5 Complete
              </span>
            }
          >
            <div className="space-y-2">
              {[
                { key: 'materialsCut', label: '1. Materials Requisitioned & Cut', sub: 'Cut-list pieces confirmed & marked' },
                { key: 'frameWelded', label: '2. Outer Frame Welded & Squared', sub: 'Diagonals verified within ±2mm' },
                { key: 'primerApplied', label: '3. Welds Ground & Primer Coated', sub: 'Anti-rust primer applied uniformly' },
                { key: 'canvasWrapped', label: '4. Canvas Received & Gallery Wrapped', sub: 'Proper tension & neat corner folds' },
                { key: 'qaPassed', label: '5. Quality Control Sign-Off', sub: 'Ready for client pickup / logistics' },
              ].map(step => (
                <div 
                  key={step.key}
                  onClick={() => handleToggleMilestone(step.key)}
                  className={`p-2.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    form.checklist[step.key]
                      ? 'bg-status-success-bg border-status-success-border text-on-surface'
                      : 'bg-surface-container-low border-outline text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-colors ${
                    form.checklist[step.key]
                      ? 'bg-secondary text-on-secondary border-secondary'
                      : 'border-outline-variant bg-surface-container'
                  }`}>
                    {form.checklist[step.key] && <Check size={11} strokeWidth={3} />}
                  </div>
                  <div className="min-w-0">
                    <span className={`text-xs font-bold block ${form.checklist[step.key] ? 'text-status-success-on' : 'text-on-surface'}`}>
                      {step.label}
                    </span>
                    <span className="text-[10px] text-on-surface-variant block">
                      {step.sub}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </DetailFieldGroup>

          {/* Execution & Financial Summary */}
          <DetailFieldGroup label="Execution & Financial Summary" icon={DollarSign}>
            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline space-y-3">
              <div>
                <span className="text-[9px] uppercase font-bold text-on-surface-variant block tracking-wider mb-0.5">Contract Value</span>
                <p className="text-xl font-mono font-black text-primary">
                  LKR {Number(job.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-outline">
                <div className="p-2.5 bg-surface-container rounded-xl border border-outline">
                  <span className="text-[9px] uppercase font-bold text-on-surface-variant block tracking-wider">Total Area</span>
                  <p className="text-xs font-mono font-bold text-on-surface flex items-center mt-0.5">
                    <Ruler size={11} className="mr-1 text-primary" /> {job.totalSqFt || Math.round((form.frameWidth * form.frameHeight / 92903) * 10) / 10} SqFt
                  </p>
                </div>
                <div className="p-2.5 bg-surface-container rounded-xl border border-outline">
                  <span className="text-[9px] uppercase font-bold text-on-surface-variant block tracking-wider">Deadline</span>
                  <p className="text-xs font-mono font-bold text-status-warning-on flex items-center mt-0.5">
                    <Clock size={11} className="mr-1" /> {job.deadline || "TBA"}
                  </p>
                </div>
              </div>
            </div>
          </DetailFieldGroup>

          {/* Quality & Factory Notes */}
          <DetailFieldGroup label="Quality Assurance Notes" icon={AlertCircle}>
            <textarea
              name="note"
              value={form.note}
              onChange={handleChange}
              rows={2}
              className="w-full p-3 bg-surface-container-highest/60 border border-outline rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
              placeholder="Critical notes, weld inspection criteria, or special instructions..."
            />
          </DetailFieldGroup>

          {/* Work Order Assignee */}
          <DetailFieldGroup label="Factory Lead Assignee" icon={User}>
            <div className="flex bg-surface-container-highest/60 border border-outline rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/50">
              <div className="flex items-center px-3 bg-surface-container-high border-r border-outline-variant text-xs text-on-surface-variant">
                <User size={13} />
              </div>
              <input 
                type="text"
                name="assignee"
                value={form.assignee}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-transparent text-xs font-bold text-on-surface focus:outline-none"
                placeholder="e.g. Saman (Master Welder)"
              />
            </div>
          </DetailFieldGroup>

        </DetailModalSidebar>

      </div>

      {/* Universal Footer */}
      <DetailModalFooter
        secondaryActions={
          <button
            type="button"
            onClick={printWorkOrder}
            className="px-4 py-2 bg-surface-container-high border border-outline-variant rounded-xl text-on-surface font-bold text-xs hover:bg-surface-variant transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer"
          >
            <Printer size={13} />
            <span>Print Work Order</span>
          </button>
        }
        onClose={onClose}
        closeText="Cancel"
        primaryActions={
          <button 
            type="button"
            onClick={handleSave}
            className="px-6 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs sm:text-sm hover:bg-primary/90 transition-all flex items-center space-x-1.5 shadow-[0_0_15px_rgba(0,218,243,0.2)] active:scale-95 cursor-pointer"
          >
            <Save size={14} />
            <span>Save Production Updates</span>
          </button>
        }
      />

    </DetailModalLayout>
  );
}
