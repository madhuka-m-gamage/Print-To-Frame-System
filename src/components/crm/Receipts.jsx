import React, { useState } from 'react';
import {
  Search, FileText, Printer, Trash2, X, ChevronRight, Calendar, Download, ArrowLeft, CreditCard
} from 'lucide-react';
import { deleteDocument, COLLECTIONS } from '../../services/firestoreSync';
import { toast } from '../../utils/toast';
import { logActivity } from '../../services/auditLog';
import DeleteModal from '../common/DeleteModal';
import { PageHeader, FilterBar, StatusBadge } from '../common/ui';
import { exportToCsv } from '../../utils/csvExport';
import { buildReceiptHtml } from '../../utils/receiptTemplate';
import { openInvoicePrintWindow } from '../../utils/invoiceTemplate';

// A receipt is inherently a completed record — no "mark paid" (that already
// happened, it's why the receipt exists), no edit (correcting a mistake
// means deleting and re-generating from the invoice, keeping the
// invoiceId <-> receiptId derivation always trustworthy). Modeled directly
// on Invoices.jsx's list/detail/print/CSV pattern.
export default function Receipts({ receipts = [], currentUser }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [mobileView, setMobileView] = useState('list');
  const [deleteId, setDeleteId] = useState(null);

  const totalReceived = receipts.reduce((acc, r) => acc + (Number(r.amountReceived) || 0), 0);
  const advanceCount = receipts.filter(r => r.type === 'Advance').length;
  const finalCount = receipts.filter(r => r.type === 'Final').length;

  const filteredReceipts = receipts.filter((r) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      r.customerName?.toLowerCase().includes(query) ||
      r.company?.toLowerCase().includes(query) ||
      r.id?.toLowerCase().includes(query) ||
      r.invoiceId?.toLowerCase().includes(query)
    );
    if (!matchesSearch) return false;
    if (activeFilter === 'advance') return r.type === 'Advance';
    if (activeFilter === 'final') return r.type === 'Final';
    return true;
  });

  const handleExportCsv = () => {
    const exportColumns = [
      { key: 'id', label: 'Receipt ID' },
      { key: 'invoiceId', label: 'Invoice ID' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'company', label: 'Company' },
      { key: 'type', label: 'Settlement Type' },
      { key: 'amountReceived', label: 'Amount Received (LKR)' },
      { key: 'paymentMethod', label: 'Payment Method' },
      { key: 'date', label: 'Date' },
      { key: 'partnerId', label: 'Referring Partner' },
    ];
    exportToCsv(filteredReceipts, exportColumns, 'Receipts_Export');
    toast.success(`Exported ${filteredReceipts.length} receipts to CSV`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDocument(COLLECTIONS.RECEIPTS, deleteId);
      toast.success('Receipt deleted successfully');
      await logActivity(
        currentUser?.identifier || currentUser?.email || 'unknown',
        currentUser?.name || 'Unknown',
        'RECEIPT_DELETED',
        'Receipts',
        `Receipt ${deleteId} permanently deleted`
      );
      if (selectedReceipt?.id === deleteId || selectedReceipt?._firestoreId === deleteId) {
        setSelectedReceipt(null);
      }
      setDeleteId(null);
    } catch (error) {
      toast.error('Error deleting receipt: ' + error.message);
    }
  };

  const printReceipt = () => {
    if (!selectedReceipt) return;
    const html = buildReceiptHtml(selectedReceipt);
    openInvoicePrintWindow(html);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col pb-6">
      <PageHeader
        title="Receipts"
        subtitle="Payment-received records issued against settled invoices — proof of payment, not a billing demand."
        metrics={[
          { label: "Total Received", value: `LKR ${totalReceived.toLocaleString()}`, color: "emerald" },
          { label: "Advance Receipts", value: advanceCount, color: "warning" },
          { label: "Final Receipts", value: finalCount, color: "cyan" },
          { label: "Total Receipts", value: receipts.length, color: "neutral" }
        ]}
        actions={
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-container border border-outline-variant hover:border-primary/40 text-on-surface rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex-shrink-0"
            title="Export filtered receipts to CSV"
          >
            <Download size={15} className="text-primary" />
            <span>Export CSV</span>
          </button>
        }
      />

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by receipt ID, invoice ID, client name..."
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        filterOptions={[
          { id: 'all', label: 'All Receipts', count: receipts.length },
          { id: 'advance', label: '75% Advance', count: advanceCount },
          { id: 'final', label: '25% Final', count: finalCount }
        ]}
        totalCount={receipts.length}
        filteredCount={filteredReceipts.length}
      />

      <div className="flex-1 flex lg:flex-row flex-col gap-6 overflow-hidden min-h-0">
        {/* Left: Receipt List */}
        <div className={`w-full lg:w-1/3 flex flex-col border border-outline-variant/60 bg-surface-container/60 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.15)] h-full ${mobileView === 'detail' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-surface-container-low/80 p-3.5 px-4 border-b border-outline-variant/60 flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-wider flex-shrink-0">
            <span className="flex items-center gap-2">
              <FileText size={14} className="text-primary" />
              Receipt Archive ({filteredReceipts.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/30">
            {filteredReceipts.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-sm font-medium">
                <FileText size={36} className="mx-auto mb-3 opacity-25 text-on-surface-variant" />
                <p className="font-bold text-on-surface">No receipts found</p>
                <p className="text-xs text-on-surface-variant mt-1">Receipts are generated from a paid invoice's Payment Status panel, or from the Invoices module.</p>
              </div>
            ) : (
              filteredReceipts.map((r) => {
                const isSelected = selectedReceipt?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => { setSelectedReceipt(r); setMobileView('detail'); }}
                    className={`p-4 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-primary/10 border-l-4 border-primary shadow-inner'
                        : 'hover:bg-surface-container-high/40 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-xs text-on-surface font-mono tracking-tight">{r.id}</span>
                        <StatusBadge status="Paid" size="xs" />
                        <span className="text-[9px] font-bold text-primary/90 bg-primary/10 px-1.5 py-0.5 rounded uppercase">
                          {r.type === 'Final' ? '25% Final' : '75% Advance'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-on-surface truncate mb-0.5">
                        {r.customerName || 'Direct Client'}
                        {r.company && <span className="text-on-surface-variant font-normal"> • {r.company}</span>}
                      </p>
                      <div className="text-[10px] text-on-surface-variant font-medium flex items-center gap-3 font-mono">
                        <span className="flex items-center gap-1"><Calendar size={11} className="opacity-70" />{r.date}</span>
                        <span className="flex items-center gap-1"><CreditCard size={11} className="opacity-70" />{r.paymentMethod || 'Cash'}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <div>
                        <p className="font-black text-xs sm:text-sm text-on-surface font-mono">
                          LKR {Number(r.amountReceived).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-status-success-on">Received</p>
                      </div>
                      <ChevronRight size={14} className={`text-on-surface-variant/40 transition-transform ${isSelected ? 'text-primary translate-x-0.5' : ''}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Receipt Detail */}
        <div className={`w-full lg:w-2/3 h-full ${mobileView === 'list' ? 'hidden lg:block' : 'block'}`}>
          {selectedReceipt ? (
            <div className="bg-surface-container/70 h-full border border-outline-variant/60 rounded-3xl p-6 sm:p-8 shadow-[0_4px_25px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden">
              <button
                type="button"
                onClick={() => setMobileView('list')}
                className="lg:hidden flex items-center gap-1.5 text-xs font-bold text-primary mb-4 p-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 w-fit transition-colors"
              >
                <ArrowLeft size={14} /> Back to Receipts
              </button>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 pb-5 border-b border-outline-variant/60 flex-shrink-0">
                <div className="flex items-center space-x-3.5">
                  <div className="p-3 bg-emerald-500/15 text-emerald-400 rounded-2xl border border-emerald-500/30 shadow-sm">
                    <FileText size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h3 className="font-black text-lg sm:text-xl text-on-surface font-mono tracking-tight">
                        {selectedReceipt.id}
                      </h3>
                      <StatusBadge status="Paid" size="xs" />
                      <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 uppercase">
                        {selectedReceipt.type === 'Final' ? '25% Settlement' : '75% Advance'}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium">
                      Received from: <span className="font-bold text-on-surface">{selectedReceipt.customerName}</span>
                      {selectedReceipt.company && <span> ({selectedReceipt.company})</span>}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setDeleteId(selectedReceipt._firestoreId || selectedReceipt.id)}
                  className="p-2.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all border border-rose-500/20 self-end sm:self-auto"
                  title="Delete Receipt"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 flex-shrink-0">
                <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/50">
                  <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Amount Received</p>
                  <p className="text-sm font-black text-on-surface font-mono mt-0.5">
                    LKR {Number(selectedReceipt.amountReceived || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/50">
                  <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Payment Method</p>
                  <p className="text-sm font-black text-on-surface font-mono mt-0.5">{selectedReceipt.paymentMethod || 'Cash'}</p>
                </div>
                <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/50">
                  <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Date</p>
                  <p className="text-sm font-black text-on-surface font-mono mt-0.5">{selectedReceipt.date || '—'}</p>
                </div>
                <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/50">
                  <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Against Invoice</p>
                  <p className="text-sm font-black text-primary font-mono mt-0.5">{selectedReceipt.invoiceId || '—'}</p>
                </div>
              </div>

              <div className="flex-1 bg-surface-container-low/90 rounded-2xl border border-outline-variant/60 p-5 overflow-y-auto font-mono text-xs text-on-surface whitespace-pre-wrap custom-scrollbar shadow-inner leading-relaxed min-h-[160px]">
                {selectedReceipt.notes || `Payment confirmed against invoice ${selectedReceipt.invoiceId || '—'} for ${selectedReceipt.customerName || 'client'}.`}
                {selectedReceipt.partnerId && `\n\nReferring Partner: ${selectedReceipt.partnerId}`}
              </div>

              <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-outline-variant/60 pt-4 flex-shrink-0">
                <div className="text-[10px] text-on-surface-variant font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Settled document — proof of payment</span>
                </div>
                <button
                  onClick={printReceipt}
                  className="flex-1 sm:flex-initial bg-surface-container-high text-on-surface hover:bg-surface-variant px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 border border-outline-variant/60"
                >
                  <Printer size={15} />
                  <span>Print PDF Receipt</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[350px] flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/60 rounded-3xl text-on-surface-variant bg-surface-container/40 p-8 text-center">
              <FileText size={56} className="mb-3 opacity-20 text-on-surface" />
              <h3 className="font-bold text-base text-on-surface">No Receipt Selected</h3>
              <p className="text-xs max-w-sm text-on-surface-variant mt-1.5 leading-relaxed">
                Select a receipt from the archive on the left to inspect it or print a PDF copy.
              </p>
            </div>
          )}
        </div>
      </div>

      <DeleteModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Receipt Record?"
        message="Are you sure you want to permanently delete this receipt? This does not affect the underlying invoice's Paid status. This action cannot be undone."
      />
    </div>
  );
}
