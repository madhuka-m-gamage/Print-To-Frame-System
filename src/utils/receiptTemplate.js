/**
 * ============================================================
 * Print To Frame ERP — Canonical Receipt Print Template
 * ============================================================
 * A receipt confirms money already received — it is not a restyled
 * invoice. Deliberately no bank-details/COD messaging (that's pre-payment
 * language), no 75%/25% split math, and no dispatcher/client signature
 * pair — just what was paid, when, how, and against which invoice.
 * Shares openInvoicePrintWindow() from invoiceTemplate.js (the window/
 * document.write mechanics are identical for any printed document).
 */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function threeDigitsToWords(n) {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + ' ';
    n %= 10;
  }
  if (n > 0) {
    str += ONES[n] + ' ';
  }
  return str.trim();
}

/**
 * Converts a non-negative number (LKR amount) into English words, e.g.
 * 22526.53 -> "Twenty Two Thousand Five Hundred Twenty Six and 53/100".
 * Deliberately simple (thousands/millions only — plenty for this business's
 * invoice sizes) rather than a general-purpose numeral-to-words library.
 */
export function amountToWords(amount) {
  const value = Math.max(0, Number(amount) || 0);
  const whole = Math.floor(value);
  const cents = Math.round((value - whole) * 100);

  if (whole === 0) return `Zero and ${String(cents).padStart(2, '0')}/100`;

  const parts = [];
  let remaining = whole;
  const scales = [['', 1], ['Thousand', 1000], ['Million', 1000000], ['Billion', 1000000000]];
  const chunks = [];
  for (let i = scales.length - 1; i >= 0; i--) {
    const [label, scale] = scales[i];
    if (remaining >= scale) {
      const chunkValue = Math.floor(remaining / scale);
      remaining %= scale;
      if (chunkValue > 0) chunks.push(label ? `${threeDigitsToWords(chunkValue)} ${label}` : threeDigitsToWords(chunkValue));
    }
  }
  parts.push(...chunks);
  return `${parts.join(' ').trim()} and ${String(cents).padStart(2, '0')}/100`;
}

/**
 * @param {Object} receipt - The real, persisted receipt record (id,
 *   invoiceId, type, customerName, company, amountReceived, paymentMethod,
 *   date, notes).
 * @returns {string} Complete HTML document string.
 */
export function buildReceiptHtml(receipt) {
  const r = receipt || {};
  const receiptNo = r.id || r._firestoreId || 'DRAFT-RECEIPT';
  const isFinal = r.type === 'Final';
  const dateStr = r.date || new Date().toISOString().split('T')[0];
  const amount = Number(r.amountReceived || 0);

  const clientHeader = r.company
    ? `<strong>${r.company}</strong><br/><span style="color:#64748b;">Attn: ${r.customerName || 'Valued Client'}</span>`
    : `<strong>${r.customerName || 'Valued Client'}</strong>`;

  return `
    <html>
      <head>
        <title>${receiptNo} — Print To Frame</title>
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
          .meta-box { text-align: right; }
          .meta-box p { margin: 3px 0; font-size: 13px; color: #475569; }
          .meta-box .receipt-id {
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
            background: #dcfce7;
            color: #15803d;
            border: 1px solid #86efac;
          }
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
          .bill-to-content { font-size: 14px; line-height: 1.5; }
          .amount-box {
            margin-bottom: 28px;
            padding: 24px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 12px;
            text-align: center;
          }
          .amount-box .figure {
            font-family: 'JetBrains Mono', monospace;
            font-size: 32px;
            font-weight: 800;
            color: #15803d;
          }
          .amount-box .words {
            font-size: 12px;
            color: #475569;
            margin-top: 8px;
            font-style: italic;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .details-table td {
            padding: 10px 0;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
          }
          .details-table td:first-child { color: #64748b; }
          .details-table td:last-child { text-align: right; font-weight: 600; }
          .thank-you {
            text-align: center;
            font-size: 13px;
            color: #475569;
            margin-bottom: 30px;
          }
          .signatures {
            margin-top: 35px;
            display: flex;
            justify-content: flex-end;
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
            <span class="badge">PAYMENT RECEIVED</span>
            <div class="receipt-id" style="margin-top: 6px;">${receiptNo}</div>
            <p>Date: ${dateStr}</p>
            <p class="mono-text" style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #0284c7; font-weight: 700;">Against Invoice: ${r.invoiceId || '—'}</p>
          </div>
        </div>

        <div class="bill-to-section">
          <h4 class="section-title">Received From</h4>
          <div class="bill-to-content">${clientHeader}</div>
        </div>

        <div class="amount-box">
          <div class="figure">LKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="words">${amountToWords(amount)} Rupees</div>
        </div>

        <table class="details-table">
          <tr>
            <td>Settlement Type</td>
            <td>${isFinal ? '25% Final Settlement' : '75% Advance Payment'}</td>
          </tr>
          <tr>
            <td>Payment Method</td>
            <td>${r.paymentMethod || 'Cash'}</td>
          </tr>
          ${r.notes ? `<tr><td>Notes</td><td>${r.notes}</td></tr>` : ''}
        </table>

        <p class="thank-you">Thank you for your business — Print To Frame Pvt Ltd</p>

        <div class="signatures">
          <div>________________________________<br/>Received By (Print To Frame)</div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `;
}
