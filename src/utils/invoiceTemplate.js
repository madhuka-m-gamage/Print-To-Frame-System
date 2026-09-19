/**
 * ============================================================
 * Print To Frame ERP — Canonical Invoice Print Template
 * ============================================================
 * The single source of truth for what a printed invoice looks like.
 * Previously three call sites (Invoices.jsx, LeadCardDetails.jsx,
 * LogisticsCardDetails.jsx) each hand-wrote their own HTML/CSS from
 * scratch and had drifted apart — different fonts, colors, a badge that
 * only sometimes mentioned COD/payment status, signature lines and a
 * delivery-location field present in only one of the three. Printing the
 * SAME invoice from two different screens produced two different-looking
 * documents. Every print call site should build its HTML through
 * buildInvoiceHtml() and open it via openInvoicePrintWindow() instead of
 * maintaining its own copy.
 */

import { stripEmojis } from './validation';

/**
 * @param {Object} params
 * @param {Object} params.invoice - The real, persisted invoice record
 *   (id, type, status, amount, totalValue, date, dueDate, lineItems,
 *   aiDraft, customerName, company, linkedJobNo).
 * @param {string} [params.customerPhone] - Shown only if provided.
 * @param {string} [params.deliveryLocation] - Shown only if provided —
 *   omit entirely for a context with no delivery destination (e.g.
 *   printing straight from a Lead/Quotation, before any logistics job
 *   exists) rather than showing a misleading placeholder.
 * @returns {string} Complete HTML document string.
 */
export function buildInvoiceHtml({ invoice, customerPhone = '', deliveryLocation = '' }) {
  const inv = invoice || {};
  const invoiceNo = inv.id || inv._firestoreId || 'DRAFT';
  const isFinal = inv.type === 'Final';
  const isPaid = inv.status === 'Paid';
  const dateStr = inv.date || new Date().toISOString().split('T')[0];
  const invoiceAmount = Number(inv.amount || 0);
  const totalContractValue = Number(inv.totalValue) || (isFinal ? (invoiceAmount > 0 ? invoiceAmount / 0.25 : 0) : (invoiceAmount > 0 ? invoiceAmount / 0.75 : 0));
  const advanceAmount = isFinal ? totalContractValue * 0.75 : invoiceAmount;
  const balanceAmount = isFinal ? invoiceAmount : totalContractValue * 0.25;
  const badgeText = isFinal ? '25% Final Settlement Invoice' : '75% Advance Invoice';
  const lineItemTitle = isFinal ? 'Final Settlement Payment (25%)' : 'Custom Framing Advance Payment (75%)';

  const clientHeader = inv.company
    ? `<strong>${inv.company}</strong><br/><span style="color:#64748b;">Attn: ${inv.customerName || 'Valued Client'}</span>`
    : `<strong>${inv.customerName || 'Valued Client'}</strong>`;

  const cleanDeliveryLocation = stripEmojis(deliveryLocation || '');

  return `
    <html>
      <head>
        <title>${invoiceNo} — Print To Frame</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
          body {
            font-family: 'Outfit', sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 40px;
            background-color: #ffffff;
          }
          .header-container {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #00daf3;
            padding-bottom: 24px;
            margin-bottom: 28px;
          }
          .logo {
            font-size: 22px;
            font-weight: 800;
            color: #0b0e14;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .meta-box {
            text-align: right;
          }
          .meta-box p {
            margin: 3px 0;
            font-size: 13px;
            color: #475569;
          }
          .meta-box .invoice-id {
            font-family: 'JetBrains Mono', monospace;
            font-size: 18px;
            font-weight: 700;
            color: #0b0e14;
          }
          .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .badge-unpaid { background: #fee2e2; color: #b91c1c; border: 1px solid #f87171; }
          .badge-paid { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .bill-to-section {
            margin-bottom: 28px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-left: 4px solid #00daf3;
            border-radius: 8px;
            padding: 16px 20px;
          }
          .section-title {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: #64748b;
            margin-top: 0;
            margin-bottom: 6px;
          }
          .bill-to-content {
            font-size: 14px;
            line-height: 1.5;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 28px;
          }
          th {
            background-color: #0b0e14;
            padding: 12px 16px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #ffffff;
            text-align: left;
          }
          td {
            padding: 12px 16px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
            line-height: 1.5;
          }
          .mono-text {
            font-family: 'JetBrains Mono', monospace;
          }
          .totals-container {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
          }
          .totals-table {
            width: 380px;
            margin-bottom: 0;
          }
          .totals-table td {
            padding: 6px 16px;
            border: none;
          }
          .totals-table tr.grand-total td {
            border-top: 2px solid #00daf3;
            font-size: 15px;
            font-weight: 800;
            color: #0b0e14;
            padding-top: 12px;
          }
          .bank-box {
            margin-top: 20px;
            padding: 14px 18px;
            border-radius: 8px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            font-size: 12px;
            color: #1e3a8a;
            line-height: 1.6;
          }
          .signatures {
            margin-top: 35px;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #475569;
            border-top: 1px dashed #cbd5e1;
            padding-top: 20px;
          }
          @media print {
            body { padding: 15px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div>
            <div class="logo">
              <img src="${typeof window !== 'undefined' ? window.location.origin : ''}/logo-light.png" alt="Print To Frame" style="height: 30px; width: auto; margin-right: 8px;" />
              Print To Frame Pvt Ltd
            </div>
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">
              Premium Steel Framing & Gallery Canvas Wraps<br/>
              Kadawatha Hub, Sri Lanka • Hotline: +94 71 141 9027 • Email: orders@printtoframe.lk
            </p>
          </div>
          <div class="meta-box">
            <span class="badge ${isPaid ? 'badge-paid' : 'badge-unpaid'}">
              ${badgeText} • ${isPaid ? 'PAID & SETTLED' : 'PAYMENT DUE / COD'}
            </span>
            <div class="invoice-id" style="margin-top: 6px;">${invoiceNo}</div>
            <p>Date: ${dateStr}${inv.dueDate ? ` | Due: ${inv.dueDate}` : ''}</p>
            ${inv.linkedJobNo ? `<p class="mono-text" style="font-size: 11px; color: #0284c7; font-weight: 700; margin-top: 2px;">Job Ref: #${inv.linkedJobNo}</p>` : ''}
          </div>
        </div>

        <div class="bill-to-section">
          <h4 class="section-title">Invoiced Client${cleanDeliveryLocation ? ' & Delivery Destination' : ''}</h4>
          <div class="bill-to-content">${clientHeader}</div>
          ${(cleanDeliveryLocation || customerPhone) ? `
          <div style="font-size: 12px; color: #475569; margin-top: 4px;">
            ${cleanDeliveryLocation ? `<strong>Delivery Location:</strong> ${cleanDeliveryLocation}` : ''}
            ${customerPhone ? `${cleanDeliveryLocation ? '<br/>' : ''}<strong>Contact Phone:</strong> ${customerPhone}` : ''}
          </div>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>Description / Order Specification</th>
              <th style="text-align: center; width: 80px;">Qty</th>
              <th style="text-align: right; width: 160px;">Amount (LKR)</th>
            </tr>
          </thead>
          <tbody>
            ${inv.lineItems && inv.lineItems.length > 0 ? inv.lineItems.map(item => `
              <tr>
                <td>
                  <strong>${item.description || 'Fabrication Item'}</strong>
                  ${item.unit ? `<span style="font-size:11px; color:#64748b; margin-left:6px;">(${item.unit})</span>` : ''}
                </td>
                <td style="text-align: center;" class="mono-text">${item.qty || 1}</td>
                <td style="text-align: right; font-weight: 600;" class="mono-text">${(Number(item.qty || 1) * Number(item.unitPrice || 0) * (isFinal ? 0.25 : 0.75)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `).join('') : `
              <tr>
                <td>
                  <strong>${lineItemTitle}</strong><br/>
                  <span style="font-size: 12px; color: #64748b; margin-top: 4px; display: block;">
                    ${inv.aiDraft ? inv.aiDraft.replace(/#\s*Invoice\n+/i, '').replace(/- /g, '• ') : 'Custom steel framing fabrication'}
                  </span>
                </td>
                <td style="text-align: center;" class="mono-text">1</td>
                <td style="text-align: right; font-weight: 600;" class="mono-text">${invoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `}
          </tbody>
        </table>

        <div class="totals-container">
          <table class="totals-table">
            <tr>
              <td style="color:#64748b;">Contract Value:</td>
              <td style="text-align: right;" class="mono-text">LKR ${totalContractValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style="color:#64748b;">${isFinal ? 'Advance Paid (75%):' : 'Balance Due on Delivery:'}</td>
              <td style="text-align: right;" class="mono-text">LKR ${isFinal ? advanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr class="grand-total">
              <td>${isFinal ? 'Final Settlement Due:' : 'Advance Amount Due:'}</td>
              <td style="text-align: right;" class="mono-text">LKR ${invoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </table>
        </div>

        <div class="bank-box">
          <strong>Payment Terms & Bank Details:</strong><br/>
          • <strong>Cash on Delivery (COD):</strong> Collect exact amount upon handover.<br/>
          • <strong>Bank Transfer:</strong> Nation Trust Bank - Head Office (500) | A/C: 205001028941 | Name: Madhuka Gamage | Swift: N T B E L K E L K<br/>
          • <strong>Commercial Bank:</strong> Print To Frame (Pvt) Ltd | A/C: 1000-2345-6789 | Kadawatha Branch
        </div>

        <div class="signatures">
          <div>________________________________<br/>Authorized Dispatcher / Fleet Driver</div>
          <div>________________________________<br/>Client Confirmation & Stamp</div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `;
}

/**
 * Opens a new print window and writes the given invoice HTML into it.
 * @param {string} html
 */
export function openInvoicePrintWindow(html) {
  const printWin = window.open('', '_blank', 'height=850,width=850');
  if (printWin) {
    printWin.document.write(html);
    printWin.document.close();
  }
}
