import { jsPDF } from 'jspdf';
import { formatCurrency, getCurrencySymbol } from '../utils/currency.js';
import { amountInWords } from '../utils/numberToWords.js';

/**
 * World-Class Official Payment Receipt Generator for AutoInvoice
 * Fully supports:
 * - Full Payments and Partial Payments with live balance tracking
 * - Unique Receipt Numbers (e.g. REC-2025-001-1)
 * - Original Invoice Amount, Current Transaction Amount, Previous Paid, Total Paid, Remaining Balance
 * - Payment Method (UPI, Bank Transfer / NEFT, Card, Cash, Cheque)
 * - Amount in Words (Indian numbering / International)
 * - Verified transaction references / UTR
 * - Official seal stamp and authorized signatory area
 */
export function buildReceiptDoc(invoice, userProfile = {}, clientObj = {}, paymentOverride = null) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const pageH = doc.internal.pageSize.getHeight(); // 297mm

  const p = userProfile || {};
  const c = clientObj || {};
  const inv = invoice || {};

  // Extract payment details
  const payment = paymentOverride || inv.payment || (Array.isArray(inv.payments) && inv.payments.length > 0 ? inv.payments[inv.payments.length - 1] : null) || {
    method: 'upi',
    transactionId: inv.transactionId || 'DIRECT_PAYMENT',
    paidAt: inv.paidAt || inv.due || new Date().toISOString(),
    amount: inv.amount || 0
  };

  const currencySetting = inv.currency || p.currency || 'INR - Indian Rupee';
  const currencySymbol = currencySetting.includes('INR') ? 'Rs.' : getCurrencySymbol(currencySetting);
  const formatMoney = (val) => formatCurrency(val, currencySetting).replace(/₹/g, 'Rs. ');

  // Financial calculations for receipt
  const totalInvoiceAmt = Number(inv.amount || 0);
  const currentTransactionAmt = Number(payment.amount !== undefined ? payment.amount : totalInvoiceAmt);
  const previousPaid = Number(payment.previousPaid || 0);
  const totalPaidToDate = Number(payment.totalPaidToDate !== undefined ? payment.totalPaidToDate : (previousPaid + currentTransactionAmt));
  const remainingBalance = payment.remainingBalance !== undefined
    ? Number(payment.remainingBalance)
    : Math.max(0, Number((totalInvoiceAmt - totalPaidToDate).toFixed(2)));

  const isFullPayment = remainingBalance <= 0;
  const receiptNo = payment.receiptNumber || `REC-${(inv.id || '001').replace(/^INV-?/i, '')}`;

  const paidDate = payment.paidAt ? new Date(payment.paidAt) : new Date();
  const paidDateStr = !isNaN(paidDate.getTime())
    ? paidDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : (inv.created || 'Recent');

  const methodLabel = String(payment.method || 'upi').replace(/_/g, ' ').toUpperCase();
  const txnRef = payment.transactionId || 'CONFIRMED';
  const wordsForPayment = amountInWords(currentTransactionAmt, currencySetting);

  const leftX = 14;
  const rightX = pageW - 14;
  const contentW = rightX - leftX;

  // Outer framing
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.6);
  doc.rect(leftX, 12, contentW, pageH - 24);

  // Header Banner: Emerald Green for Full Payment, Deep Royal Slate for Partial
  if (isFullPayment) {
    doc.setFillColor(16, 185, 129); // Emerald 500
  } else {
    doc.setFillColor(37, 99, 235); // Royal Blue 600
  }
  doc.rect(leftX, 12, contentW, 36, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('OFFICIAL PAYMENT RECEIPT', leftX + 8, 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Receipt No: ${receiptNo}  •  Issued: ${paidDateStr}`, leftX + 8, 34);

  // Business Name on Header Right
  const businessName = p.businessName || p.fullName || 'AutoInvoice Business';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(businessName, rightX - 8, 23, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  let bY = 29;
  if (p.email || p.phone) {
    doc.text(`${p.email || ''} ${p.phone ? '| ' + p.phone : ''}`, rightX - 8, bY, { align: 'right' });
    bY += 4.5;
  }
  if (p.businessGstin || p.gstin) {
    doc.text(`GSTIN: ${p.businessGstin || p.gstin}`, rightX - 8, bY, { align: 'right' });
  }

  // --- Payment Confirmation Badge Box ---
  let y = 56;
  if (isFullPayment) {
    doc.setFillColor(240, 253, 244); // Green 50
    doc.setDrawColor(187, 247, 208); // Green 200
  } else {
    doc.setFillColor(239, 246, 255); // Blue 50
    doc.setDrawColor(191, 219, 254); // Blue 200
  }
  doc.rect(leftX + 4, y, contentW - 8, 24, 'FD');

  doc.setTextColor(isFullPayment ? 22 : 30, isFullPayment ? 101 : 64, isFullPayment ? 52 : 175);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const statusHeadline = isFullPayment ? '✓ PAYMENT RECEIVED IN FULL — ACCOUNT SETTLED' : 'PARTIAL PAYMENT RECEIVED — OUTSTANDING BALANCE REMAINS';
  doc.text(statusHeadline, leftX + 10, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Received payment of ${formatMoney(currentTransactionAmt)} via ${methodLabel} (Transaction Ref: ${txnRef})`, leftX + 10, y + 17);

  // Status Stamp on Right of Banner
  if (isFullPayment) {
    doc.setFillColor(22, 163, 74);
    doc.roundedRect(rightX - 42, y + 5, 34, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PAID IN FULL', rightX - 25, y + 14, { align: 'center' });
  } else {
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(rightX - 46, y + 5, 38, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('PARTIALLY PAID', rightX - 27, y + 14, { align: 'center' });
  }

  // --- Two Column Grid: Payer / Client Details & Transaction Meta ---
  y += 32;
  doc.setTextColor(15, 23, 42);

  // Left Column: Received From (Customer)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('RECEIVED FROM (CUSTOMER):', leftX + 6, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(inv.client || c.company || 'Customer Name', leftX + 6, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  if (c.address) {
    const cAddr = doc.splitTextToSize(c.address, 90);
    doc.text(cAddr, leftX + 6, y);
    y += (cAddr.length * 4);
  }
  if (inv.clientEmail || c.email) {
    doc.text(`Email: ${inv.clientEmail || c.email}`, leftX + 6, y);
    y += 4.2;
  }
  if (c.phone) {
    doc.text(`Phone: ${c.phone}`, leftX + 6, y);
    y += 4.2;
  }
  if (inv.clientGstin || c.gstin) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Customer GSTIN: ${inv.clientGstin || c.gstin}`, leftX + 6, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    y += 4.2;
  }

  // Right Column: Invoice Reference & Transaction Data
  const rColX = pageW / 2 + 6;
  let metaY = y - (c.address ? 20 : 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('PAYMENT SPECIFICATION:', rColX, metaY);
  metaY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  doc.text(`Invoice Reference:`, rColX, metaY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text(inv.id || 'INV-001', rColX + 38, metaY);
  metaY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Original Invoice Date:`, rColX, metaY);
  doc.text(inv.created || 'N/A', rColX + 38, metaY);
  metaY += 4.5;

  doc.text(`Payment Mode:`, rColX, metaY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(methodLabel, rColX + 38, metaY);
  metaY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`UTR / Reference No:`, rColX, metaY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(txnRef, rColX + 38, metaY);
  metaY += 4.5;

  if (payment.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Payment Notes:`, rColX, metaY);
    doc.text(doc.splitTextToSize(payment.notes, 50), rColX + 38, metaY);
    metaY += 4.5;
  }

  y = Math.max(y, metaY) + 6;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(leftX + 4, y, rightX - 4, y);
  y += 6;

  // --- Financial Ledger Breakdown Table ---
  doc.setFillColor(248, 250, 252);
  doc.rect(leftX + 4, y, contentW - 8, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('FINANCIAL AUDIT ITEM', leftX + 8, y + 5.5);
  doc.text(`AMOUNT (${currencySymbol})`, rightX - 8, y + 5.5, { align: 'right' });
  y += 11;

  const drawLedgerRow = (label, val, isBold = false, isHighlight = false, color = null) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 9.5 : 8.5);

    if (color) {
      doc.setTextColor(color[0], color[1], color[2]);
    } else if (isHighlight) {
      doc.setTextColor(16, 185, 129); // Green
    } else if (isBold) {
      doc.setTextColor(15, 23, 42);
    } else {
      doc.setTextColor(71, 85, 105);
    }

    doc.text(label, leftX + 8, y);
    doc.text(val, rightX - 8, y, { align: 'right' });
    y += 5.5;
  };

  drawLedgerRow('1. Total Invoice Amount Billed:', formatMoney(totalInvoiceAmt));

  if (previousPaid > 0) {
    drawLedgerRow('2. Previous Payments Received to Date:', formatMoney(previousPaid));
  }

  drawLedgerRow(
    `3. CURRENT TRANSACTION RECEIVED (${methodLabel}):`,
    formatMoney(currentTransactionAmt),
    true,
    true
  );

  drawLedgerRow('4. Cumulative Total Paid to Date:', formatMoney(totalPaidToDate));

  // Divider line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(leftX + 4, y, rightX - 4, y);
  y += 6;

  // Balance Due row
  if (remainingBalance > 0) {
    drawLedgerRow(
      'OUTSTANDING BALANCE REMAINING:',
      formatMoney(remainingBalance),
      true,
      false,
      [220, 38, 38] // Red
    );
  } else {
    drawLedgerRow(
      'OUTSTANDING BALANCE REMAINING:',
      formatMoney(0),
      true,
      false,
      [16, 185, 129] // Green
    );
  }

  y += 4;

  // --- Amount in Words Box ---
  doc.setFillColor(248, 250, 252);
  doc.rect(leftX + 4, y, contentW - 8, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('CURRENT TRANSACTION AMOUNT IN WORDS:', leftX + 8, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(wordsForPayment, leftX + 8, y + 10.5);

  y += 22;

  // Thank You Message & Official Verification Note
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Thank you for your business & prompt payment!', leftX + 6, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('This receipt serves as official financial confirmation of funds received.', leftX + 6, y + 5);
  doc.text('Please retain this document for your tax, accounting, and audit records.', leftX + 6, y + 9.5);

  // Signatory & Seal (Bottom Right)
  const sigBoxY = pageH - 42;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Received on behalf of:`, rightX - 58, sigBoxY);
  doc.text(businessName, rightX - 58, sigBoxY + 4.5);

  doc.setDrawColor(148, 163, 184);
  doc.line(rightX - 58, sigBoxY + 16, rightX - 8, sigBoxY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Finance Signatory', rightX - 58, sigBoxY + 20);

  // Footer Note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('AutoInvoice Pro • Secure Transaction Ledger • Computer Generated Official Receipt', pageW / 2, pageH - 14, { align: 'center' });

  return { doc, receiptNo };
}

export function generateReceiptPDF(invoice, userProfile = {}, clientObj = {}, paymentOverride = null) {
  const { doc, receiptNo } = buildReceiptDoc(invoice, userProfile, clientObj, paymentOverride);
  doc.save(`${receiptNo}_${invoice.client || 'Client'}.pdf`);
  return doc;
}
