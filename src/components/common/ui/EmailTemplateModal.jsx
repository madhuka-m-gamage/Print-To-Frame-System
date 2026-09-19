import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mail, Copy, Check, ExternalLink, Sparkles, X, FileText, 
  Send, RefreshCw, Layers, User, Shield, CheckCheck, Eye
} from 'lucide-react';
import ModalWrapper from './detail-modal/ModalWrapper';
import { EMAIL_TEMPLATES, interpolateTemplate } from '../../../constants/emailTemplates';
import { toast } from '../../../utils/toast';

export default function EmailTemplateModal({
  isOpen = false,
  onClose,
  recipient = {},
  initialTemplateId,
  currentUser
}) {
  // Determine default template based on recipient role or provided prop
  const defaultTemplateId = useMemo(() => {
    if (initialTemplateId) return initialTemplateId;
    const role = recipient?.role;
    if (role === 'Partner') return 'partner_approval';
    if (role === 'Business Client') return 'client_approval';
    if (['Admin', 'Manager', 'Sales', 'Operations', 'Support', 'Accounts', 'Logistics'].includes(role)) {
      return 'employee_invite';
    }
    return 'quote_submission';
  }, [recipient, initialTemplateId]);

  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplateId);
  const [templateCategory, setTemplateCategory] = useState('ALL');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const categories = useMemo(() => {
    return ['ALL', ...new Set(EMAIL_TEMPLATES.map(t => t.category))];
  }, []);

  const filteredTemplates = useMemo(() => {
    if (templateCategory === 'ALL') return EMAIL_TEMPLATES;
    return EMAIL_TEMPLATES.filter(t => t.category === templateCategory);
  }, [templateCategory]);

  // Template definition
  const activeTemplate = useMemo(() => {
    return EMAIL_TEMPLATES.find(t => t.id === selectedTemplateId) || EMAIL_TEMPLATES[0];
  }, [selectedTemplateId]);

  // Build interpolation data
  const templateVariables = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://portal.print2frame.xyz';
    return {
      recipientName: recipient?.name || recipient?.businessName || 'Valued Partner',
      companyName: recipient?.company || recipient?.businessName || recipient?.name || 'Company',
      partnerId: recipient?.partnerId || (recipient?.identifier ? `P-${recipient.identifier.slice(0, 5).toUpperCase()}` : 'P-PARTNER'),
      loginEmail: recipient?.identifier || recipient?.email || '',
      // A stored user/partner record never carries a real password (it's
      // stripped before write, by design) — this composer can't relay one for
      // an existing account the way the automated enroll/approve emails can
      // for a brand-new one. Say so plainly rather than a vague placeholder.
      tempPassword: recipient?.tempPassword || '[Not available here — passwords aren\'t stored; use Admin Password Reset to set a new one]',
      assignedRole: recipient?.role || 'Authorized Member',
      requestedRole: recipient?.role || 'Partner Access',
      contactPhone: recipient?.contactNumber || recipient?.mobile || recipient?.phone || '+94 71 141 9027',
      portalUrl: origin,
      senderName: currentUser?.name ? `${currentUser.name} (${currentUser.role || 'Admin'})` : 'Print To Frame Admin Desk',
      supportEmail: 'support@print2frame.xyz',
      quoteRef: recipient?.quoteId || 'QT-PREVIEW',
      jobScope: recipient?.jobScope || recipient?.scope || 'Custom Steel Frame Fabrication & Tension Mounting',
      totalSqFt: recipient?.totalSqFt || '120.00',
      totalValue: Number(recipient?.value || 240000).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      advanceAmount: Number((recipient?.value || 240000) * 0.75).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      balanceAmount: Number((recipient?.value || 240000) * 0.25).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      // Uses this specific partner's real negotiated rate when composing for
      // one (Partners.jsx's Email button passes the actual partner record) —
      // previously hardcoded to 53.5 regardless of who the email was for.
      commissionRate: Number(recipient?.commissionRate || 53.5).toFixed(2),
      commissionAmount: Number((recipient?.totalSqFt || 120) * Number(recipient?.commissionRate || 53.5)).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      invoiceId: 'INV-' + String(Date.now()).slice(-6),
      jobNo: 'JOB-' + String(Date.now()).slice(-6),
      dueDate: 'Within 7 Days',
      deliveryDate: 'Scheduled Handover',
      qaDate: 'Tomorrow, 4:00 PM',
      deliveryAddress: recipient?.address || recipient?.deliveryLocation || 'Client Designated Site / Gallery',
      deliveryTime: '10:00 AM – 2:00 PM',
      vehicleNumber: 'WP-CAR-7845',
      driverName: 'Kasun Perera',
      driverPhone: '+94 77 345 8912',
    };
  }, [recipient, currentUser]);

  // Update subject and body when template or variables change
  useEffect(() => {
    if (activeTemplate) {
      setSubject(interpolateTemplate(activeTemplate.subject, templateVariables));
      setBody(interpolateTemplate(activeTemplate.body, templateVariables));
    }
  }, [activeTemplate, templateVariables]);

  const handleCopySubject = async () => {
    try {
      await navigator.clipboard.writeText(subject);
      setCopiedSubject(true);
      toast.success('Email Subject copied to clipboard!');
      setTimeout(() => setCopiedSubject(false), 2000);
    } catch (e) {
      toast.error('Failed to copy subject');
    }
  };

  const handleCopyBody = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopiedBody(true);
      toast.success('Email Body copied to clipboard!');
      setTimeout(() => setCopiedBody(false), 2000);
    } catch (e) {
      toast.error('Failed to copy email body');
    }
  };

  const handleCopyAll = async () => {
    try {
      const fullText = `Subject: ${subject}\n\n${body}`;
      await navigator.clipboard.writeText(fullText);
      setCopiedAll(true);
      toast.success('Complete Email Draft (Subject & Body) copied!');
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (e) {
      toast.error('Failed to copy draft');
    }
  };

  const handleOpenGmailWeb = () => {
    const toEmail = recipient?.identifier || recipient?.email || '';
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    toast.success('Opening Gmail draft in new browser tab...');
  };

  const handleOpenMailClient = () => {
    const toEmail = recipient?.identifier || recipient?.email || '';
    const mailtoUrl = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
    toast.info('Opening in default mail application...');
  };

  if (!isOpen) return null;

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-6xl"
      height="h-[95dvh] sm:h-[92vh] max-h-[960px]"
      ariaLabel="Email Communication Composer"
    >
      {/* Modal Top Header */}
      <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low/80 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20 flex-shrink-0">
            <Mail size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-black text-on-surface truncate">
              Email Template Dispatcher
            </h3>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-0.5 truncate">
              Auto-Interpolated Notification for <span className="text-primary font-extrabold">{recipient?.name || recipient?.identifier || 'Recipient'}</span>
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 text-on-surface-variant hover:text-on-surface bg-surface-container-high rounded-full border border-outline-variant/60 transition-colors cursor-pointer"
          title="Close Modal"
        >
          <X size={18} />
        </button>
      </div>

      {/* Modal Content Body — Spacious 2-Column Responsive Workspace */}
      <div className="p-5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* LEFT PANEL: 5 Columns on Desktop (Category Filter, Templates List, Data Context) */}
          <div className="lg:col-span-5 space-y-4 flex flex-col">
            
            {/* Category Filter Pills */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-2 tracking-widest">
                Template Category ({categories.length}):
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTemplateCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                      templateCategory === cat
                        ? 'bg-primary/20 text-primary border-primary/40 shadow-sm'
                        : 'bg-surface-container-high text-on-surface-variant border-outline-variant/60 hover:text-on-surface'
                    }`}
                  >
                    {cat === 'ALL' ? 'All Templates' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Selector Cards List */}
            <div className="flex-1 flex flex-col min-h-0">
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-2 tracking-widest">
                Select Template ({filteredTemplates.length} of {EMAIL_TEMPLATES.length}):
              </label>
              <div className="space-y-2 max-h-[320px] lg:max-h-[440px] overflow-y-auto custom-scrollbar pr-1 flex-1">
                {filteredTemplates.map((tmpl) => {
                  const isSelected = selectedTemplateId === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      className={`w-full p-3 text-left rounded-xl border transition-all text-xs flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-primary/15 border-primary text-on-surface ring-1 ring-primary shadow-sm'
                          : 'bg-surface-container-low hover:bg-surface-container-high/60 border-outline-variant/60 text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <div className="font-bold text-xs line-clamp-1 mb-1">{tmpl.title}</div>
                      <div className="flex items-center justify-between text-[9px] opacity-70 font-mono mt-1">
                        <span>{tmpl.category}</span>
                        {isSelected && <span className="font-bold text-primary uppercase">Active</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Context Data Card */}
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/40 flex items-center gap-2 flex-wrap text-[11px] flex-shrink-0">
              <span className="text-on-surface-variant font-bold text-[10px] uppercase tracking-wider mr-1">
                Data Context:
              </span>
              <span className="bg-surface-container-high px-2 py-0.5 rounded-md font-medium text-on-surface">
                To: <span className="font-bold text-primary">{recipient?.identifier || recipient?.email || 'N/A'}</span>
              </span>
              <span className="bg-surface-container-high px-2 py-0.5 rounded-md font-medium text-on-surface">
                Role: <span className="font-bold">{recipient?.role || 'Partner'}</span>
              </span>
              {recipient?.partnerId && (
                <span className="bg-surface-container-high px-2 py-0.5 rounded-md font-mono text-on-surface">
                  ID: <span className="font-bold text-amber-400">{recipient.partnerId}</span>
                </span>
              )}
            </div>

          </div>

          {/* RIGHT PANEL: 7 Columns on Desktop (Subject line & Wide Message Body) */}
          <div className="lg:col-span-7 space-y-4 flex flex-col">
            
            {/* Subject Line Input + Copy Button */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">
                  Email Subject Line
                </label>
                <button
                  type="button"
                  onClick={handleCopySubject}
                  className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  {copiedSubject ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedSubject ? 'Copied!' : 'Copy Subject'}</span>
                </button>
              </div>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs sm:text-sm font-bold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Email Message Body Textarea + Copy Button */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">
                  Message Body (Editable Preview)
                </label>
                <button
                  type="button"
                  onClick={handleCopyBody}
                  className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  {copiedBody ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedBody ? 'Copied Body!' : 'Copy Body'}</span>
                </button>
              </div>
              <textarea
                rows={16}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full flex-1 min-h-[320px] lg:min-h-[420px] p-4 bg-surface-container-low border border-outline-variant rounded-2xl text-xs font-mono leading-relaxed text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary custom-scrollbar resize-y"
              />
            </div>

          </div>

        </div>
      </div>

      {/* Modal Bottom Footer Actions */}
      <div className="p-4 sm:p-5 border-t border-outline-variant bg-surface-container-low/90 backdrop-blur-md flex flex-col sm:flex-row justify-between items-center gap-3 flex-shrink-0">
        <div className="text-[11px] text-on-surface-variant font-medium text-center sm:text-left">
          Ready to paste into <span className="font-bold text-on-surface">Gmail, Outlook, or Apple Mail</span>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={handleCopyAll}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition-all active:scale-95 cursor-pointer ${
              copiedAll
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-surface-container-high hover:bg-surface-variant text-on-surface border-outline-variant/60'
            }`}
          >
            {copiedAll ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copiedAll ? 'Draft Copied!' : 'Copy Full Draft'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenMailClient}
            className="flex-1 sm:flex-none px-3.5 py-2.5 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/60 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            title="Open in default desktop mail application (Apple Mail, Outlook, Thunderbird)"
          >
            <ExternalLink size={14} />
            <span>Default Mail Client</span>
          </button>

          <button
            type="button"
            onClick={handleOpenGmailWeb}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-primary text-on-primary font-bold text-xs sm:text-sm rounded-xl hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(0,218,243,0.3)] active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            title="Open pre-filled draft in Gmail Web browser tab"
          >
            <Send size={14} />
            <span>Open in Gmail (Web)</span>
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
