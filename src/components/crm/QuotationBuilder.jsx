import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Sparkles, FileText, Copy, ChevronRight, Check, X, Layers, HardDrive, MessageCircle, Send } from 'lucide-react';
import { toast } from '../../utils/toast';
import { generateStructuredQuotation } from '../../services/gemini';
import { addDocument, updateDocument, COLLECTIONS, generateInvoiceId } from '../../services/firestoreSync';
import GoogleDrivePickerModal from '../common/GoogleDrivePickerModal';
import { ModalWrapper } from '../common/ui';
import { matchesEntity } from '../../utils/entityUtils';

// WhatsApp renders *text* as bold and _text_ as italic client-side — this
// converts those same markers to HTML purely for the in-app chat-bubble
// preview, so what the admin previews visually matches what WhatsApp will
// actually show once pasted/sent, without changing the copied plain text.
function whatsAppMarkupToHtml(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

const STATUS_STYLES = {
  Draft: 'text-on-surface-variant bg-surface-container-high border-outline-variant',
  Sent: 'text-status-ready-on bg-status-ready/10 border-status-ready/30',
  Accepted: 'text-status-success-on bg-status-success/10 border-status-success/30',
  Rejected: 'text-status-danger-on bg-status-danger/10 border-status-danger/30',
  Invoiced: 'text-primary bg-primary/10 border-primary/30',
};

const mkItem = () => ({
  id: Date.now() + Math.random(),
  description: '',
  qty: 1,
  unit: 'job',
  unitPrice: 0,
  taxPct: 0,
  discountPct: 0,
});

const lineTotal = (item) => {
  const base = Number(item.qty || 0) * Number(item.unitPrice || 0);
  const afterDiscount = base * (1 - Number(item.discountPct || 0) / 100);
  return afterDiscount * (1 + Number(item.taxPct || 0) / 100);
};

export default function QuotationBuilder({ lead, allQuotations = [], onSaveInvoice, currentUser, advanceInvoice = null, finalInvoice = null }) {
  // matchesEntity (src/utils/entityUtils.js) resolves ID fragmentation across
  // the Lead -> Deal conversion lifecycle from both directions — the Deal's
  // originalLeadId pointing back, and the Lead's convertedDealId pointing
  // forward to what it became — so a quote/invoice created on either side of
  // that split is still found regardless of which record is currently open.
  const leadQuotes = useMemo(() =>
    (allQuotations || [])
      .filter(q => matchesEntity(q, lead))
      .sort((a, b) => (Number(b.version) || 1) - (Number(a.version) || 1)),
    [allQuotations, lead]
  );

  const latestQuote = leadQuotes[0] || null;

  const [activeQuote, setActiveQuote] = useState(latestQuote);
  const [isEditing, setIsEditing] = useState(!latestQuote);
  const [status, setStatus] = useState(latestQuote?.status || 'Draft');
  const [lineItems, setLineItems] = useState(
    latestQuote?.lineItems?.map(item => ({ ...item, id: item.id || Date.now() + Math.random() })) || [mkItem()]
  );
  const [notes, setNotes] = useState(latestQuote?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [showWhatsAppPreview, setShowWhatsAppPreview] = useState(false);
  const [isConvertingAdvance, setIsConvertingAdvance] = useState(false);
  const [isConvertingFinal, setIsConvertingFinal] = useState(false);

  // Sync if latestQuote changes and not dirty
  React.useEffect(() => {
    if (latestQuote && !activeQuote) {
      setActiveQuote(latestQuote);
      setStatus(latestQuote.status || 'Draft');
      setLineItems(latestQuote.lineItems?.map(item => ({ ...item, id: item.id || Date.now() + Math.random() })) || [mkItem()]);
      setNotes(latestQuote.notes || '');
      setIsEditing(false);
    }
  }, [latestQuote, activeQuote]);

  const subtotal = lineItems.reduce((s, i) => s + lineTotal(i), 0);
  const grandTotal = subtotal;
  const advanceDue = grandTotal * 0.75;
  const balanceDue = grandTotal * 0.25;

  const setField = (id, field, val) =>
    setLineItems(prev => prev.map(i =>
      i.id === id ? { ...i, [field]: ['description', 'unit'].includes(field) ? val : Number(val) || 0 } : i
    ));

  const handleGenerate = async () => {
    const scope = lead.jobScope || lead.scope || '';
    if (scope.length < 5) {
      toast.error('Please enter a Job Scope in the lead details first.');
      return;
    }
    setIsGenerating(true);
    try {
      const client = { name: lead.name, company: lead.company, email: lead.email, phone: lead.phone };
      const items = await generateStructuredQuotation(client, scope, lead.deliveryLocation, lead.pricingMetadata, currentUser);
      if (Array.isArray(items) && items.length > 0) {
        setLineItems(items.map(i => ({ ...i, id: Date.now() + Math.random() })));
        toast.success(`AI drafted ${items.length} line items from scope.`);
      } else {
        toast.error('AI returned no line items. Please try again.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to generate line items.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!lineItems.length || lineItems.every(i => !i.description)) {
      toast.error('Add at least one line item with a description.');
      return;
    }
    setIsSaving(true);
    try {
      const cleanItems = lineItems.map(({ id, ...rest }) => rest);
      const payload = {
        leadId: lead.id || lead._firestoreId,
        clientName: lead.name || '',
        company: lead.company || '',
        phone: lead.phone || '',
        status,
        lineItems: cleanItems,
        subtotal,
        grandTotal,
        advanceDue,
        balanceDue,
        notes,
        scope: lead.jobScope || '',
        createdBy: currentUser?.email || 'sales',
        updatedAt: new Date().toISOString(),
      };

      if (activeQuote?._firestoreId || activeQuote?.id) {
        const docId = activeQuote._firestoreId || activeQuote.id;
        await updateDocument(COLLECTIONS.QUOTATIONS, docId, payload);
        toast.success('Quotation updated successfully!');
      } else {
        const version = (latestQuote?.version || 0) + 1;
        const newId = `QT-${String(Date.now()).slice(-6)}`;
        await addDocument(COLLECTIONS.QUOTATIONS, {
          ...payload,
          version,
          id: newId,
          createdAt: new Date().toISOString(),
        }, newId);
        toast.success(`Quotation v${version} created successfully!`);
      }
      setIsEditing(false);
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewVersion = async () => {
    if (!lineItems.length) {
      toast.error('Add line items before creating a new version.');
      return;
    }
    const newVer = (Number(latestQuote?.version) || 1) + 1;
    setIsSaving(true);
    try {
      const cleanItems = lineItems.map(({ id, ...rest }) => rest);
      const newId = `QT-${String(Date.now()).slice(-6)}`;
      const payload = {
        leadId: lead.id || lead._firestoreId,
        clientName: lead.name || '',
        company: lead.company || '',
        phone: lead.phone || '',
        status: 'Draft',
        lineItems: cleanItems,
        subtotal,
        grandTotal,
        advanceDue,
        balanceDue,
        notes,
        scope: lead.jobScope || '',
        createdBy: currentUser?.email || 'sales',
        version: newVer,
        parentQuoteId: activeQuote?._firestoreId || activeQuote?.id || '',
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addDocument(COLLECTIONS.QUOTATIONS, payload, newId);
      toast.success(`New version v${newVer} created as Draft`);
      setStatus('Draft');
      setIsEditing(true);
    } catch (err) {
      toast.error('Failed to create new version: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConvertToAdvanceInvoice = async () => {
    // Hard stop against duplicate generation — nothing else in this flow
    // ever blocked repeated clicks, which is exactly what produced multiple
    // Advance invoices (INV-ADV-0006, 0007, 0008...) for the same lead.
    // Once one exists, this button renders as a static confirmation instead
    // (see the JSX below) so this guard is a defensive backstop, not the
    // only protection — but it also covers the in-flight double-click case.
    if (advanceInvoice || isConvertingAdvance) return;
    if (status !== 'Accepted') {
      toast.error('Mark quotation as Accepted before converting to invoice.');
      return;
    }
    if (!onSaveInvoice) {
      toast.error('Invoice save handler unavailable.');
      return;
    }
    setIsConvertingAdvance(true);
    try {
      let invId;
      try {
        invId = await generateInvoiceId('Advance');
      } catch (err) {
        toast.error('Failed to generate an invoice number: ' + err.message);
        return;
      }
      const invoiceDate = new Date().toISOString().split('T')[0];
      onSaveInvoice({
        id: invId,
        leadId: lead.id || lead._firestoreId,
        linkedJobNo: lead.jobNo || lead.linkedJobNo || '',
        jobNo: lead.jobNo || lead.linkedJobNo || '',
        quotationId: activeQuote?._firestoreId || activeQuote?.id || '',
        customerName: lead.name || 'Direct Customer',
        company: lead.company || '',
        phone: lead.phone || '',
        date: invoiceDate,
        amount: advanceDue,
        totalValue: grandTotal,
        advancePaid: 0,
        balanceDue: balanceDue,
        type: 'Advance',
        status: 'Unpaid',
        aiDraft: lead.jobScope || 'Custom steel framing 75% advance invoice',
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        lineItems: lineItems.map(({ id, ...rest }) => rest),
      });
      toast.success('75% Advance invoice generated & linked!');
    } finally {
      setIsConvertingAdvance(false);
    }
  };

  const handleConvertToFinalInvoice = async () => {
    if (finalInvoice || isConvertingFinal) return;
    if (status !== 'Accepted') {
      toast.error('Mark quotation as Accepted before generating final invoice.');
      return;
    }
    if (!onSaveInvoice) {
      toast.error('Invoice save handler unavailable.');
      return;
    }
    setIsConvertingFinal(true);
    try {
      let invId;
      try {
        invId = await generateInvoiceId('Final');
      } catch (err) {
        toast.error('Failed to generate an invoice number: ' + err.message);
        return;
      }
      const invoiceDate = new Date().toISOString().split('T')[0];
      onSaveInvoice({
        id: invId,
        leadId: lead.id || lead._firestoreId,
        linkedJobNo: lead.jobNo || lead.linkedJobNo || '',
        jobNo: lead.jobNo || lead.linkedJobNo || '',
        quotationId: activeQuote?._firestoreId || activeQuote?.id || '',
        customerName: lead.name || 'Direct Customer',
        company: lead.company || '',
        phone: lead.phone || '',
        date: invoiceDate,
        amount: balanceDue,
        totalValue: grandTotal,
        advancePaid: advanceDue,
        balanceDue: balanceDue,
        type: 'Final',
        status: 'Unpaid',
        aiDraft: lead.jobScope || 'Custom steel framing 25% final settlement invoice',
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        lineItems: lineItems.map(({ id, ...rest }) => rest),
      });
      toast.success('25% Final Settlement invoice generated & linked!');
    } finally {
      setIsConvertingFinal(false);
    }
  };

  // Plain-text quotation summary for sharing over WhatsApp/SMS — deliberately
  // NOT AI-generated (no Gemini call): built straight from the real line
  // items and totals already on screen, so it always matches the actual
  // quote instead of a separately-drafted description of it.
  const buildWhatsAppQuoteText = () => {
    const describedItems = lineItems.filter(i => i.description);
    const itemsText = describedItems
      .map(i => `• ${i.description} — LKR ${lineTotal(i).toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
      .join('\n');

    return [
      `*Print To Frame — Quotation*`,
      ``,
      `Hi ${lead.name || 'there'}, thank you for reaching out! Here's a summary of your quotation:`,
      lead.jobScope ? `\n*Scope:* ${lead.jobScope}` : null,
      lead.deliveryLocation ? `*Delivery Location:* ${lead.deliveryLocation}` : null,
      itemsText ? `\n*Itemized Breakdown:*\n${itemsText}` : null,
      `\n*Grand Total:* LKR ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `• 75% Advance on commencement: LKR ${advanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `• 25% Final on delivery: LKR ${balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      notes ? `\n_Note: ${notes}_` : null,
      `\nPlease let us know if you'd like to proceed — happy to answer any questions!`,
      `— Print To Frame`,
    ].filter(v => v !== null).join('\n');
  };

  const switchToQuote = (q) => {
    setActiveQuote(q);
    setLineItems(q.lineItems?.map(i => ({ ...i, id: i.id || Date.now() + Math.random() })) || [mkItem()]);
    setStatus(q.status || 'Draft');
    setNotes(q.notes || '');
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/15 text-primary rounded-lg">
            <FileText size={14} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-widest">Structured Line-Item Quote</h4>
            {leadQuotes.length > 0 && (
              <p className="text-[9px] text-on-surface-variant mt-0.5">
                {leadQuotes.length} version{leadQuotes.length > 1 ? 's' : ''} on record · Active: v{activeQuote?.version || latestQuote?.version || 1}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeQuote && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg hover:bg-primary/20 transition-colors"
            >
              Edit Quote
            </button>
          )}
          {activeQuote && isEditing && (
            <button
              type="button"
              onClick={handleNewVersion}
              disabled={isSaving}
              className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg hover:bg-amber-400/20 transition-colors flex items-center gap-1"
            >
              <Copy size={10} /> Clone to v{(Number(latestQuote?.version) || 1) + 1}
            </button>
          )}
        </div>
      </div>

      {/* Version history tabs */}
      {leadQuotes.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {leadQuotes.map(q => (
            <button
              key={q._firestoreId || q.id}
              type="button"
              onClick={() => switchToQuote(q)}
              className={`flex-shrink-0 px-3 py-1 rounded-xl text-[10px] font-bold border transition-colors ${
                (activeQuote?._firestoreId || activeQuote?.id) === (q._firestoreId || q.id)
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-surface-container border-outline-variant text-on-surface-variant hover:border-primary/30'
              }`}
            >
              v{q.version || 1} · {q.status || 'Draft'}
            </button>
          ))}
        </div>
      )}

      {/* Status pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase font-extrabold text-on-surface tracking-wider">Quote Status:</span>
        {['Draft', 'Sent', 'Accepted', 'Rejected'].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => isEditing && setStatus(s)}
            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
              status === s ? STATUS_STYLES[s] : 'text-on-surface bg-surface-container-highest border border-outline hover:border-primary/50'
            } ${isEditing ? 'cursor-pointer hover:border-outline-variant' : 'cursor-default'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* AI Generate Action */}
      {isEditing && (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`w-full py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            isGenerating
              ? 'bg-primary/40 text-on-surface cursor-wait'
              : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 active:scale-[0.99]'
          }`}
        >
          <Sparkles size={13} />
          {isGenerating ? 'AI analyzing pricing & scope...' : 'AI Auto-Itemize Line Items from Job Scope'}
        </button>
      )}

      {/* Line Items Table */}
      <div className="rounded-xl border border-outline-variant overflow-hidden">
        <div className="bg-surface-container-highest px-3.5 py-2.5 border-b border-outline flex justify-between items-center">
          <span className="text-xs font-extrabold text-on-surface uppercase tracking-wider">Bill of Quantities / Line Items</span>
          {isEditing && (
            <button
              type="button"
              onClick={() => setLineItems(p => [...p, mkItem()])}
              className="text-[9px] font-bold text-primary flex items-center gap-1 hover:text-primary/80"
            >
              <Plus size={10} /> Add Item Row
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr className="bg-surface-container-high border-b border-outline">
                <th className="text-left p-2 text-xs font-extrabold text-on-surface uppercase tracking-wider">Description</th>
                <th className="text-center p-2 text-xs font-extrabold text-on-surface uppercase tracking-wider w-14">Qty</th>
                <th className="text-center p-2 text-xs font-extrabold text-on-surface uppercase tracking-wider w-16">Unit</th>
                <th className="text-right p-2 text-xs font-extrabold text-on-surface uppercase tracking-wider w-28">Unit Price</th>
                <th className="text-right p-2 text-xs font-extrabold text-on-surface uppercase tracking-wider w-28">Total</th>
                {isEditing && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {lineItems.map(item => (
                <tr key={item.id} className="hover:bg-surface-container/30">
                  <td className="p-2">
                    {isEditing ? (
                      <input
                        value={item.description}
                        onChange={e => setField(item.id, 'description', e.target.value)}
                        className="w-full bg-transparent text-on-surface text-xs focus:outline-none border-b border-transparent focus:border-primary/50"
                        placeholder="Specification / Material description..."
                      />
                    ) : (
                      <span className="text-on-surface font-medium">{item.description || '—'}</span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.qty}
                        min="0.01"
                        step="0.01"
                        onChange={e => setField(item.id, 'qty', e.target.value)}
                        className="w-12 bg-transparent text-center text-on-surface text-xs focus:outline-none border-b border-transparent focus:border-primary/50"
                      />
                    ) : (
                      item.qty
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {isEditing ? (
                      <input
                        value={item.unit}
                        onChange={e => setField(item.id, 'unit', e.target.value)}
                        className="w-14 bg-transparent text-center text-on-surface text-xs focus:outline-none border-b border-transparent focus:border-primary/50"
                        placeholder="job"
                      />
                    ) : (
                      item.unit
                    )}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.unitPrice}
                        min="0"
                        onChange={e => setField(item.id, 'unitPrice', e.target.value)}
                        className="w-28 bg-transparent text-right text-on-surface text-xs font-mono focus:outline-none border-b border-transparent focus:border-primary/50"
                      />
                    ) : (
                      Number(item.unitPrice || 0).toLocaleString()
                    )}
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-on-surface">
                    LKR {lineTotal(item).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {isEditing && (
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => setLineItems(p => p.filter(i => i.id !== item.id))}
                        className="text-rose-400/60 hover:text-rose-400 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="bg-surface-container-high border-t-2 border-outline p-4 space-y-2">
          <div className="flex justify-between text-xs text-on-surface-variant">
            <span>Subtotal:</span>
            <span className="font-mono">LKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-on-surface border-t border-outline-variant/50 pt-1.5">
            <span>Grand Total (Net Payable):</span>
            <span className="font-mono text-primary">LKR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
              <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">75% Advance Due</p>
              <p className="text-xs font-black text-amber-400 font-mono mt-0.5">
                LKR {advanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg text-center">
              <p className="text-[9px] font-bold text-primary uppercase tracking-wider">25% Final on Delivery</p>
              <p className="text-xs font-black text-primary font-mono mt-0.5">
                LKR {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp/Text Quote Share — quotations only, never invoices; a
          plain-text alternative to the PDF for sharing over chat. */}
      <button
        type="button"
        onClick={() => setShowWhatsAppPreview(true)}
        className="w-full py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
      >
        <MessageCircle size={14} /> Preview & Share Quote as Text (WhatsApp)
      </button>

      {/* Notes / Special Instructions */}
      {isEditing && (
        <div>
          <label className="block text-[9px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
            Quotation Notes & Delivery Terms
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
            placeholder="e.g. 75% advance required prior to fabrication, 25% balance upon installation..."
          />
        </div>
      )}

      {/* Save / Convert / Add Actions */}
      <div className="flex flex-col gap-2 pt-1">
        {isEditing && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              isSaving
                ? 'bg-primary/40 cursor-wait'
                : 'bg-primary text-on-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(0,218,243,0.2)] active:scale-[0.99]'
            }`}
          >
            <Check size={13} />
            {isSaving ? 'Saving...' : activeQuote ? 'Update Saved Quotation' : 'Save Quotation v1 to Database'}
          </button>
        )}

        {status === 'Accepted' && !isEditing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Once generated, this becomes a static confirmation, never a
                repeatable action — viewing/printing the real invoice already
                happens via the Payment Status panel elsewhere in this card. */}
            {advanceInvoice ? (
              <div className="w-full py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5">
                <Check size={13} /> Advance Invoice Generated — {advanceInvoice.id || advanceInvoice._firestoreId}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConvertToAdvanceInvoice}
                disabled={isConvertingAdvance}
                className="w-full py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 disabled:cursor-wait"
              >
                <ChevronRight size={13} /> {isConvertingAdvance ? 'Generating...' : '75% Advance Invoice'}
              </button>
            )}
            {finalInvoice ? (
              <div className="w-full py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5">
                <Check size={13} /> Final Settlement Generated — {finalInvoice.id || finalInvoice._firestoreId}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConvertToFinalInvoice}
                disabled={isConvertingFinal}
                className="w-full py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 disabled:cursor-wait"
              >
                <ChevronRight size={13} /> {isConvertingFinal ? 'Generating...' : '25% Final Settlement'}
              </button>
            )}
          </div>
        )}

        {!isEditing && !activeQuote && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="w-full py-2.5 bg-surface-container border border-outline-variant/60 text-on-surface-variant hover:text-primary rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={13} /> Create Structured Line-Item Quotation
          </button>
        )}

        {/* Google Drive Attachments */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowDriveModal(true)}
            className="w-full py-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <HardDrive size={14} className="text-primary" />
            <span>{attachedFiles.length > 0 ? `${attachedFiles.length} Google Drive File(s) Attached` : 'Attach Google Drive Art File / Proof'}</span>
          </button>
          {attachedFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {attachedFiles.map(file => (
                <div key={file.id} className="flex items-center justify-between px-3 py-1.5 bg-surface-container-low rounded-lg text-xs border border-outline-variant/50">
                  <span className="truncate text-on-surface font-medium">{file.name}</span>
                  <button onClick={() => setAttachedFiles(p => p.filter(f => f.id !== file.id))} className="text-rose-400 hover:text-rose-500">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <GoogleDrivePickerModal
        isOpen={showDriveModal}
        onClose={() => setShowDriveModal(false)}
        onSelectFile={(file) => {
          if (!attachedFiles.some(f => f.id === file.id)) {
            setAttachedFiles(prev => [...prev, file]);
            toast.success(`Attached "${file.name}" from Google Drive`);
          }
        }}
      />

      {/* WhatsApp Text Quote — mobile chat-bubble preview + copy/share */}
      <ModalWrapper
        isOpen={showWhatsAppPreview}
        onClose={() => setShowWhatsAppPreview(false)}
        maxWidth="max-w-sm"
        ariaLabel="Share Quote as WhatsApp Text"
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/60 shrink-0">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <MessageCircle size={16} className="text-emerald-400" /> Share Quote as Text
            </h3>
            <button onClick={() => setShowWhatsAppPreview(false)} className="text-on-surface-variant hover:text-on-surface p-1">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-5">
            <div className="w-full max-w-[300px] rounded-[28px] border-4 border-neutral-800 bg-neutral-900 shadow-xl overflow-hidden">
              <div className="bg-emerald-600 px-3 py-2.5 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(lead.name || 'C')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-bold leading-tight truncate">{lead.name || 'Client'}</p>
                  <p className="text-emerald-100 text-[9px] leading-tight">online</p>
                </div>
              </div>
              <div
                className="p-3 min-h-[220px] max-h-[400px] overflow-y-auto"
                style={{ backgroundColor: '#0b141a' }}
              >
                <div
                  className="bg-[#005c4b] text-white text-[11px] leading-relaxed rounded-lg rounded-tr-none px-3 py-2 ml-auto max-w-[92%] shadow-sm whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{ __html: whatsAppMarkupToHtml(buildWhatsAppQuoteText()) }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-5 pt-0 shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(buildWhatsAppQuoteText());
                toast.success('Quote text copied — paste it into WhatsApp or SMS!');
              }}
              className="py-2.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Copy size={13} /> Copy Text
            </button>
            <button
              type="button"
              onClick={() => {
                const phone = (lead.phone || '').replace(/[^0-9]/g, '');
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppQuoteText())}`, '_blank');
              }}
              className="py-2.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Send size={13} /> Open in WhatsApp
            </button>
          </div>
        </div>
      </ModalWrapper>
    </div>
  );
}
