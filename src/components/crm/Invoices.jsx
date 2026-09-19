import React, { useState } from 'react';
import { 
  Search, FileText, Check, DollarSign, Calendar, Printer, Edit2,
  Trash2, X, ChevronRight, AlertCircle, Building2, User, Layers, Download, MessageSquare, Clock, ArrowLeft, Receipt
} from 'lucide-react';
import { updateDocument, deleteDocument, COLLECTIONS } from '../../services/firestoreSync';
import { toast } from '../../utils/toast';
import { logActivity } from '../../services/auditLog';
import DeleteModal from '../common/DeleteModal';
import { PageHeader, FilterBar, StatusBadge, ModalWrapper } from '../common/ui';
import { exportToCsv } from '../../utils/csvExport';
import { buildInvoiceHtml, openInvoicePrintWindow } from '../../utils/invoiceTemplate';
import { buildReceiptHtml } from '../../utils/receiptTemplate';

export default function Invoices({ invoices = [], setInvoices, onMarkPaid, currentUser, receipts = [], onGenerateReceipt }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [mobileView, setMobileView] = useState('list');
  const [deleteId, setDeleteId] = useState(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [receiptFormData, setReceiptFormData] = useState({ amountReceived: 0, paymentMethod: 'Cash', date: new Date().toISOString().split('T')[0] });
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);

  // Summary Metrics & Overdue Tracking (Item 7)
  const todayStr = new Date().toISOString().split('T')[0];
  const totalAmount = invoices.reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
  const paidAmount = invoices
    .filter(inv => inv.status === 'Paid')
    .reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
  const unpaidAmount = invoices
    .filter(inv => inv.status !== 'Paid')
    .reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);

  const overdueInvoices = invoices.filter(inv => inv.status !== 'Paid' && inv.dueDate && inv.dueDate < todayStr);
  const overdueAmount = overdueInvoices.reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);

  const paidCount = invoices.filter(inv => inv.status === 'Paid').length;
  const unpaidCount = invoices.filter(inv => inv.status !== 'Paid').length;
  const advanceCount = invoices.filter(inv => inv.type === 'Advance').length;
  const finalCount = invoices.filter(inv => inv.type === 'Final').length;

  const filteredInvoices = invoices.filter((inv) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      inv.customerName?.toLowerCase().includes(query) ||
      inv.company?.toLowerCase().includes(query) ||
      inv.id?.toLowerCase().includes(query)
    );

    if (!matchesSearch) return false;

    if (activeFilter === 'paid') return inv.status === 'Paid';
    if (activeFilter === 'unpaid') return inv.status !== 'Paid';
    if (activeFilter === 'overdue') return inv.status !== 'Paid' && inv.dueDate && inv.dueDate < todayStr;
    if (activeFilter === 'advance') return inv.type === 'Advance';
    if (activeFilter === 'final') return inv.type === 'Final';
    return true;
  });

  const handleExportCsv = () => {
    const exportColumns = [
      { key: 'id', label: 'Invoice ID' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'company', label: 'Company' },
      { key: 'type', label: 'Invoice Type' },
      { key: 'amount', label: 'Amount Due (LKR)' },
      { key: 'totalValue', label: 'Contract Value (LKR)' },
      { key: 'status', label: 'Payment Status' },
      { key: 'date', label: 'Issued Date' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'paidAt', label: 'Settled At' },
    ];
    exportToCsv(filteredInvoices, exportColumns, 'Invoices_Export');
    toast.success(`Exported ${filteredInvoices.length} invoices to CSV`);
  };

  const handleSendReminder = (inv) => {
    const custName = inv.customerName || 'Valued Client';
    const amount = Number(inv.amount || 0).toLocaleString();
    const dueDate = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-GB') : 'Immediate';
    const msg = encodeURIComponent(
      `Dear ${custName},\n\nThis is a friendly reminder from Print To Frame regarding Invoice ${inv.id} for LKR ${amount} (${inv.type === 'Advance' ? '75% Advance' : '25% Final Settlement'}).\nDue Date: ${dueDate}\n\nBank Transfer Details:\nNation Trust Bank - Head Office (500)\nA/C: 205001028941\nAccount Name: Madhuka Gamage\n\nPlease send us the payment confirmation slip at your earliest convenience. Thank you!`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
    toast.success('Payment reminder message opened in WhatsApp');
  };

  const handleEditClick = () => {
    setEditForm({ ...selectedInvoice });
    setIsEditing(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const docId = editForm._firestoreId || editForm.id;
    if (!docId) {
      toast.error('Cannot edit invoice: missing document ID.');
      return;
    }
    try {
      const updatedFields = {
        amount: Number(editForm.amount) || 0,
        customerName: editForm.customerName || '',
        company: editForm.company || '',
        type: editForm.type || 'Advance'
      };
      await updateDocument(COLLECTIONS.INVOICES, docId, updatedFields);
      if (setInvoices) {
        setInvoices(prev => prev.map(inv => (inv.id === docId || inv._firestoreId === docId) ? { ...inv, ...updatedFields } : inv));
      }
      toast.success('Invoice updated successfully');
      await logActivity(
        currentUser?.email || 'unknown',
        currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown',
        'INVOICE_EDITED',
        'Invoices',
        `Invoice ${docId} updated — Amount: LKR ${editForm.amount}, Type: ${editForm.type}`
      );
      setIsEditing(false);
      setSelectedInvoice(prev => ({ ...prev, ...updatedFields }));
    } catch (error) {
      toast.error('Error updating invoice: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDocument(COLLECTIONS.INVOICES, deleteId);
      if (setInvoices) {
        setInvoices(prev => prev.filter(inv => inv.id !== deleteId && inv._firestoreId !== deleteId));
      }
      toast.success('Invoice deleted successfully');
      await logActivity(
        currentUser?.email || 'unknown',
        currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown',
        'INVOICE_DELETED',
        'Invoices',
        `Invoice ${deleteId} permanently deleted`
      );
      if (selectedInvoice?.id === deleteId || selectedInvoice?._firestoreId === deleteId) {
        setSelectedInvoice(null);
      }
      setDeleteId(null);
    } catch (error) {
      toast.error('Error deleting invoice: ' + error.message);
    }
  };

  const handleMarkAsPaid = async (invId) => {
    const invToUpdate = invoices.find(inv => inv.id === invId || inv._firestoreId === invId);
    const docId = invToUpdate?._firestoreId || invToUpdate?.id || invId;
    if (!docId) {
      toast.error('Cannot update invoice: missing document ID.');
      return;
    }
    try {
      const paidAt = new Date().toISOString();
      await updateDocument(COLLECTIONS.INVOICES, docId, { status: 'Paid', paidAt });
      if (setInvoices) {
        setInvoices(prev => prev.map(inv => (inv.id === docId || inv._firestoreId === docId || inv.id === invId) ? { ...inv, status: 'Paid', paidAt } : inv));
      }
      toast.success('Invoice marked as Paid');
      await logActivity(
        currentUser?.email || 'unknown',
        currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown',
        'INVOICE_PAID',
        'Invoices',
        `Invoice ${docId} marked as Paid — Amount: LKR ${invToUpdate?.amount}, Customer: ${invToUpdate?.customerName}`
      );
      if (selectedInvoice && (selectedInvoice.id === invId || selectedInvoice._firestoreId === invId || selectedInvoice.id === docId)) {
        setSelectedInvoice(prev => ({ ...prev, status: 'Paid', paidAt }));
      }
      if (invToUpdate && invToUpdate.leadId && onMarkPaid) {
        onMarkPaid(invToUpdate.leadId, docId);
      }
    } catch (error) {
      toast.error('Error updating status: ' + error.message);
    }
  };

  const printInvoice = () => {
    if (!selectedInvoice) return;
    const html = buildInvoiceHtml({ invoice: selectedInvoice });
    openInvoicePrintWindow(html);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col pb-6">
      {/* Standardized Header */}
      <PageHeader
        title="Invoices"
        subtitle="Central billing repository for advance receipts, balance settlements, and financial audits."
        metrics={[
          { label: "Total Invoiced", value: `LKR ${totalAmount.toLocaleString()}`, color: "cyan" },
          { label: "Settled Revenue", value: `LKR ${paidAmount.toLocaleString()}`, color: "emerald" },
          { label: "Outstanding Receivables", value: `LKR ${unpaidAmount.toLocaleString()}`, color: unpaidAmount > 0 ? "warning" : "neutral" },
          { label: "Overdue Exposure", value: `LKR ${overdueAmount.toLocaleString()}`, color: overdueAmount > 0 ? "rose" : "neutral" },
          { label: "Total Invoices", value: invoices.length, color: "neutral" }
        ]}
        actions={
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-container border border-outline-variant hover:border-primary/40 text-on-surface rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex-shrink-0"
            title="Export filtered invoices to CSV"
          >
            <Download size={15} className="text-primary" />
            <span>Export CSV</span>
          </button>
        }
      />

      {/* Standardized Filter & Search Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by invoice ID, client name, company..."
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        filterOptions={[
          { id: 'all', label: 'All Invoices', count: invoices.length },
          { id: 'paid', label: 'Paid', count: paidCount },
          { id: 'unpaid', label: 'Unpaid', count: unpaidCount },
          { id: 'overdue', label: 'Overdue', count: overdueInvoices.length },
          { id: 'advance', label: '75% Advance', count: advanceCount },
          { id: 'final', label: '25% Final', count: finalCount }
        ]}
        totalCount={invoices.length}
        filteredCount={filteredInvoices.length}
      />

      {/* Main Grid split */}
      <div className="flex-1 flex lg:flex-row flex-col gap-6 overflow-hidden min-h-0">
        {/* Left Side: Invoice List */}
        <div className={`w-full lg:w-1/3 flex flex-col border border-outline-variant/60 bg-surface-container/60 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.15)] h-full ${mobileView === 'detail' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-surface-container-low/80 p-3.5 px-4 border-b border-outline-variant/60 flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-wider flex-shrink-0">
            <span className="flex items-center gap-2">
              <FileText size={14} className="text-primary" />
              Invoice Archive ({filteredInvoices.length})
            </span>
            <span className="text-[10px] text-on-surface-variant/70 lowercase font-medium">
              click to view draft
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/30">
            {filteredInvoices.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-sm font-medium">
                <FileText size={36} className="mx-auto mb-3 opacity-25 text-on-surface-variant" />
                <p className="font-bold text-on-surface">No invoices found</p>
                <p className="text-xs text-on-surface-variant mt-1">Try adjusting your search query or filter status.</p>
              </div>
            ) : (
              filteredInvoices.map((inv) => {
                const isSelected = selectedInvoice?.id === inv.id;
                const isPaid = inv.status === 'Paid';
                const isOverdue = !isPaid && inv.dueDate && inv.dueDate < todayStr;

                return (
                  <div
                    key={inv.id}
                    onClick={() => {
                      setSelectedInvoice(inv);
                      setMobileView('detail');
                    }}
                    className={`p-4 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected 
                        ? 'bg-primary/10 border-l-4 border-primary shadow-inner' 
                        : 'hover:bg-surface-container-high/40 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-xs text-on-surface font-mono tracking-tight">{inv.id}</span>
                        <StatusBadge status={inv.status} size="xs" />
                        <span className="text-[9px] font-bold text-primary/90 bg-primary/10 px-1.5 py-0.5 rounded uppercase">
                          {inv.type === 'Final' ? '25% Final' : '75% Advance'}
                        </span>
                        {(inv.linkedJobNo || inv.jobNo) && (
                          <span className="text-[9px] font-bold font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                            #{inv.linkedJobNo || inv.jobNo}
                          </span>
                        )}
                        {isOverdue && (
                          <span className="text-[9px] font-bold text-status-danger-on bg-status-danger/15 border border-status-danger/30 px-1.5 py-0.5 rounded flex items-center gap-0.5 uppercase">
                            <Clock size={9} /> Overdue
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs font-bold text-on-surface truncate mb-0.5">
                        {inv.customerName || 'Direct Client'}
                        {inv.company && (
                          <span className="text-on-surface-variant font-normal"> • {inv.company}</span>
                        )}
                      </p>

                      <div className="text-[10px] text-on-surface-variant font-medium flex items-center gap-3 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="opacity-70" />
                          {inv.date}
                        </span>
                        {inv.dueDate && (
                          <span className={isOverdue ? "text-status-danger-on font-bold" : ""}>
                            Due: {inv.dueDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <div>
                        <p className="font-black text-xs sm:text-sm text-on-surface font-mono">
                          LKR {Number(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className={`text-[9px] font-bold uppercase tracking-wider ${isPaid ? 'text-status-success-on' : isOverdue ? 'text-status-danger-on' : 'text-status-warning-on'}`}>
                          {isPaid ? 'Settled' : isOverdue ? 'Overdue' : 'Pending'}
                        </p>
                      </div>
                      <ChevronRight size={14} className={`text-on-surface-variant/40 transition-transform ${isSelected ? 'text-primary translate-x-0.5' : ''}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Invoice Detail & Draft Inspector */}
        <div className={`w-full lg:w-2/3 h-full ${mobileView === 'list' ? 'hidden lg:block' : 'block'}`}>
          {selectedInvoice ? (
            <div className="bg-surface-container/70 h-full border border-outline-variant/60 rounded-3xl p-6 sm:p-8 shadow-[0_4px_25px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden">
              
              {/* Mobile Back Button */}
              <button
                type="button"
                onClick={() => setMobileView('list')}
                className="lg:hidden flex items-center gap-1.5 text-xs font-bold text-primary mb-4 p-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 w-fit transition-colors"
              >
                <ArrowLeft size={14} /> Back to Invoices
              </button>

              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 pb-5 border-b border-outline-variant/60 flex-shrink-0">
                <div className="flex items-center space-x-3.5">
                  <div className="p-3 bg-primary/15 text-primary rounded-2xl border border-primary/30 shadow-sm">
                    <FileText size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h3 className="font-black text-lg sm:text-xl text-on-surface font-mono tracking-tight">
                        {selectedInvoice.id}
                      </h3>
                      <StatusBadge status={selectedInvoice.status} size="xs" />
                      <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 uppercase">
                        {selectedInvoice.type === 'Final' ? '25% Settlement' : '75% Advance'}
                      </span>
                      {(selectedInvoice.linkedJobNo || selectedInvoice.jobNo) && (
                        <span className="text-[10px] font-bold font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                          #{selectedInvoice.linkedJobNo || selectedInvoice.jobNo}
                        </span>
                      )}
                      {selectedInvoice.status !== 'Paid' && selectedInvoice.dueDate && selectedInvoice.dueDate < todayStr && (
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-md uppercase">
                          Overdue
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium">
                      Billed to: <span className="font-bold text-on-surface">{selectedInvoice.customerName}</span>
                      {selectedInvoice.company && <span> ({selectedInvoice.company})</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end sm:self-auto">
                  <button
                    onClick={handleEditClick}
                    className="p-2.5 bg-surface-container-high text-on-surface hover:bg-surface-variant hover:text-primary rounded-xl transition-all border border-outline-variant/60"
                    title="Edit Invoice"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteId(selectedInvoice._firestoreId || selectedInvoice.id)}
                    className="p-2.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all border border-rose-500/20"
                    title="Delete Invoice"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Summary Stats Pill Group */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 flex-shrink-0">
                <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/50">
                  <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Invoice Amount</p>
                  <p className="text-sm font-black text-on-surface font-mono mt-0.5">
                    LKR {Number(selectedInvoice.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/50">
                  <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Total Value</p>
                  <p className="text-sm font-black text-on-surface font-mono mt-0.5">
                    LKR {Number(selectedInvoice.totalValue || selectedInvoice.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/50">
                  <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Date Issued</p>
                  <p className="text-sm font-black text-on-surface font-mono mt-0.5">
                    {selectedInvoice.date || 'Today'}
                  </p>
                </div>
                <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/50">
                  <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Due Date</p>
                  <p className={`text-sm font-black font-mono mt-0.5 ${selectedInvoice.status !== 'Paid' && selectedInvoice.dueDate && selectedInvoice.dueDate < todayStr ? 'text-status-danger-on' : 'text-primary'}`}>
                    {selectedInvoice.dueDate || '—'}
                  </p>
                </div>
              </div>

              {/* Invoice Draft Render */}
              <div className="flex-1 bg-surface-container-low/90 rounded-2xl border border-outline-variant/60 p-5 overflow-y-auto font-mono text-xs text-on-surface whitespace-pre-wrap custom-scrollbar shadow-inner leading-relaxed min-h-[160px]">
                {selectedInvoice.aiDraft || 'No formal draft generated for this invoice.'}
              </div>

              {/* Footer Controls */}
              <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-outline-variant/60 pt-4 flex-shrink-0">
                <div className="text-[10px] text-on-surface-variant font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span>Reference:</span>
                  <span className="font-bold text-on-surface">
                    {(selectedInvoice.linkedJobNo || selectedInvoice.jobNo) ? `Job #${selectedInvoice.linkedJobNo || selectedInvoice.jobNo}` : ''}
                    {selectedInvoice.leadId ? ` (Lead: ${selectedInvoice.leadId})` : ((selectedInvoice.linkedJobNo || selectedInvoice.jobNo) ? '' : 'Direct')}
                  </span>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end flex-wrap">
                  {selectedInvoice.status !== 'Paid' && (
                    <button
                      onClick={() => handleSendReminder(selectedInvoice)}
                      className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all"
                      title="Send payment reminder to client via WhatsApp"
                    >
                      <MessageSquare size={14} />
                      <span>WhatsApp Reminder</span>
                    </button>
                  )}
                  <button
                    onClick={printInvoice}
                    className="flex-1 sm:flex-initial bg-surface-container-high text-on-surface hover:bg-surface-variant px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 border border-outline-variant/60"
                  >
                    <Printer size={15} />
                    <span>Print PDF Invoice</span>
                  </button>
                  {selectedInvoice.status !== 'Paid' && (
                    <button
                      onClick={() => handleMarkAsPaid(selectedInvoice.id)}
                      className="flex-1 sm:flex-initial bg-emerald-500 text-white hover:bg-emerald-600 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                    >
                      <Check size={15} />
                      <span>Mark as Paid</span>
                    </button>
                  )}
                  {selectedInvoice.status === 'Paid' && (() => {
                    const existingReceipt = receipts.find(r => r.invoiceId === (selectedInvoice.id || selectedInvoice._firestoreId));
                    if (existingReceipt) {
                      return (
                        <button
                          onClick={() => openInvoicePrintWindow(buildReceiptHtml(existingReceipt))}
                          title="Print this receipt"
                          className="flex-1 sm:flex-initial bg-surface-container-high text-emerald-400 hover:bg-emerald-400/10 border border-emerald-400/30 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95"
                        >
                          <Printer size={15} />
                          <span>Print Receipt — {existingReceipt.id}</span>
                        </button>
                      );
                    }
                    return (
                      <button
                        onClick={() => {
                          setReceiptFormData({ amountReceived: Number(selectedInvoice.amount) || 0, paymentMethod: 'Cash', date: new Date().toISOString().split('T')[0] });
                          setShowReceiptForm(true);
                        }}
                        className="flex-1 sm:flex-initial bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95"
                      >
                        <Receipt size={15} />
                        <span>Generate Receipt</span>
                      </button>
                    );
                  })()}
                </div>
              </div>

              {selectedInvoice.status === 'Paid' && showReceiptForm && !receipts.find(r => r.invoiceId === (selectedInvoice.id || selectedInvoice._firestoreId)) && (
                <div className="mt-3 p-3 bg-surface-container-high/60 border border-outline rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-bold text-on-surface-variant">Amount</label>
                    <input
                      type="number"
                      value={receiptFormData.amountReceived}
                      onChange={(e) => setReceiptFormData(prev => ({ ...prev, amountReceived: e.target.value }))}
                      className="px-2 py-1.5 bg-surface-container rounded-lg text-xs border border-outline-variant"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-bold text-on-surface-variant">Method</label>
                    <select
                      value={receiptFormData.paymentMethod}
                      onChange={(e) => setReceiptFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="px-2 py-1.5 bg-surface-container rounded-lg text-xs border border-outline-variant"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-bold text-on-surface-variant">Date</label>
                    <input
                      type="date"
                      value={receiptFormData.date}
                      onChange={(e) => setReceiptFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="px-2 py-1.5 bg-surface-container rounded-lg text-xs border border-outline-variant"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isGeneratingReceipt}
                      onClick={async () => {
                        if (!onGenerateReceipt) return;
                        setIsGeneratingReceipt(true);
                        try {
                          await onGenerateReceipt(selectedInvoice, receiptFormData);
                          setShowReceiptForm(false);
                        } finally {
                          setIsGeneratingReceipt(false);
                        }
                      }}
                      className="flex-1 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-60"
                    >
                      Confirm
                    </button>
                    <button type="button" onClick={() => setShowReceiptForm(false)} className="flex-1 py-1.5 bg-surface-container text-on-surface-variant rounded-lg text-xs font-bold cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[350px] flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/60 rounded-3xl text-on-surface-variant bg-surface-container/40 p-8 text-center">
              <FileText size={56} className="mb-3 opacity-20 text-on-surface" />
              <h3 className="font-bold text-base text-on-surface">No Invoice Selected</h3>
              <p className="text-xs max-w-sm text-on-surface-variant mt-1.5 leading-relaxed">
                Select an advance receipt or final settlement invoice from the archive on the left to inspect its billing specifications, print formal PDFs, or mark payments.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Invoice Modal */}
      {isEditing && editForm && (
        <ModalWrapper
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          maxWidth="max-w-md"
          height="h-auto max-h-[85vh]"
          ariaLabel="Edit Invoice Details"
        >
          <div className="px-6 py-5 border-b border-outline-variant bg-surface-container-low flex justify-between items-center flex-shrink-0">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-on-surface">
                Edit Invoice {editForm.id}
              </h3>
              <p className="text-[10px] uppercase font-bold text-primary tracking-widest mt-0.5">
                Financial Record Adjustment
              </p>
            </div>
            <button 
              onClick={() => setIsEditing(false)} 
              className="p-2 bg-surface-container-high text-on-surface-variant rounded-full hover:bg-surface-variant transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                Customer Name *
              </label>
              <input 
                type="text" 
                value={editForm.customerName || ''} 
                onChange={e => setEditForm({...editForm, customerName: e.target.value})} 
                className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-on-surface" 
                required 
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                Company / Organization
              </label>
              <input 
                type="text" 
                value={editForm.company || ''} 
                onChange={e => setEditForm({...editForm, company: e.target.value})} 
                className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-on-surface" 
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                Amount (LKR) *
              </label>
              <input 
                type="number" 
                min="0" 
                step="0.01" 
                value={editForm.amount || 0} 
                onChange={e => setEditForm({...editForm, amount: e.target.value})} 
                className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-primary/50 text-on-surface" 
                required 
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                Invoice Stage / Ratio
              </label>
              <select 
                value={editForm.type || 'Advance'} 
                onChange={e => setEditForm({...editForm, type: e.target.value})} 
                className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
              >
                <option value="Advance">Advance (75%)</option>
                <option value="Final">Final Settlement (25%)</option>
              </select>
            </div>

            <div className="pt-4 border-t border-outline-variant flex justify-end space-x-3">
              <button 
                type="button" 
                onClick={() => setIsEditing(false)} 
                className="px-5 py-2.5 bg-surface-container-high text-on-surface rounded-xl font-bold text-xs hover:bg-surface-container-highest transition-colors border border-outline-variant/60"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,218,243,0.2)] active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Invoice Record?"
        message="Are you sure you want to permanently delete this invoice? This action cannot be undone."
      />
    </div>
  );
}

