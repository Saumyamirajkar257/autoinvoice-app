import { jsPDF } from 'jspdf';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';

/**
 * Generates a formal, beautiful Payment Receipt PDF for Paid Invoices
 * @param {Object} invoice - The invoice data
 * @param {Object} userProfile - The business owner's profile
 * @param {Object} clientObj - The client information
 * @param {Object} paymentOverride - Optional payment info override
 */
export function generateReceiptPDF(invoice, userProfile = {}, clientObj = {}, paymentOverride = null) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const pageH = doc.internal.pageSize.getHeight(); // 297mm

  const p = userProfile || {};
  const c = clientObj || {};
  const payment = paymentOverride || invoice.payment || {
    method: 'upi',
    transactionId: invoice.transactionId || 'DIRECT_PAYMENT',
    paidAt: invoice.paidAt || invoice.due || new Date().toISOString()
  };

  const currencySetting = invoice.currency || p.currency || 'INR - Indian Rupee';
  const formatMoney = (val) => formatCurrency(val, currencySetting);
  const currencySymbol = getCurrencySymbol(currencySetting);

  const receiptNo = `REC-${(invoice.id || '001').replace(/^INV-?/i, '')}`;
  const paidDateStr = payment.paidAt
    ? new Date(payment.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : (invoice.created || 'Recent');

  // Outer border & background
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.5);
  doc.rect(12, 12, pageW - 24, pageH - 24);

  // Top Accent Header
  doc.setFillColor(22, 163, 74); // Success Emerald #16a34a
  doc.rect(12, 12, pageW - 24, 38, 'F');

  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('PAYMENT RECEIPT', 20, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Receipt #: ${receiptNo}  •  Date: ${paidDateStr}`, 20, 36);

  // Business Name on Header Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(p.businessName || p.fullName || 'AutoInvoice Business', pageW - 20, 24, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let busY = 31;
  if (p.email) {
    doc.text(p.email, pageW - 20, busY, { align: 'right' });
    busY += 4.5;
  }
  if (p.phone) {
    doc.text(p.phone, pageW - 20, busY, { align: 'right' });
    busY += 4.5;
  }
  if (p.businessGstin) {
    doc.text(`GSTIN: ${p.businessGstin}`, pageW - 20, busY, { align: 'right' });
  }

  // --- Payment Confirmation Banner ---
  let y = 58;
  doc.setFillColor(240, 253, 244); // Green 50
  doc.setDrawColor(187, 247, 208); // Green 200
  doc.rect(20, y, pageW - 40, 24, 'FD');

  doc.setTextColor(22, 101, 52); // Green 800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('✓ PAYMENT RECEIVED IN FULL', 26, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const methodLabel = (payment.method || 'UPI').toUpperCase();
  const txnRef = payment.transactionId || 'Confirmed';
  doc.text(`Payment of ${formatMoney(invoice.amount)} received via ${methodLabel} (Ref: ${txnRef})`, 26, y + 17);

  // Status Stamp on Right of Banner
  doc.setFillColor(22, 163, 74);
  doc.roundedRect(pageW - 54, y + 5, 26, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PAID', pageW - 41, y + 14, { align: 'center' });

  // --- Billed To & Payment Details Grid ---
  y += 32;
  doc.setTextColor(30, 41, 59); // Slate 800

  // Left Column: Received From (Client)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('RECEIVED FROM:', 20, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoice.client || c.company || 'Client', 20, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let cY = y + 11;
  if (invoice.clientEmail || c.email) {
    doc.text(`Email: ${invoice.clientEmail || c.email}`, 20, cY);
    cY += 5;
  }
  if (c.phone) {
    doc.text(`Phone: ${c.phone}`, 20, cY);
    cY += 5;
  }
  if (invoice.clientGstin || c.gstin) {
    doc.text(`GSTIN: ${invoice.clientGstin || c.gstin}`, 20, cY);
    cY += 5;
  }

  // Right Column: Payment Metadata
  const rColX = pageW / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TRANSACTION DETAILS:', rColX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let metaY = y + 6;
  doc.text(`Invoice Reference: ${invoice.id || 'INV-001'}`, rColX, metaY); metaY += 5;
  doc.text(`Payment Date: ${paidDateStr}`, rColX, metaY); metaY += 5;
  doc.text(`Payment Mode: ${methodLabel}`, rColX, metaY); metaY += 5;
  doc.text(`Transaction Reference: ${txnRef}`, rColX, metaY); metaY += 5;
  if (invoice.placeOfSupply) {
    doc.text(`Place of Supply: ${invoice.placeOfSupply}`, rColX, metaY);
  }

  // Divider
  y = Math.max(cY, metaY) + 6;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, y, pageW - 20, y);

  // --- Items Table ---
  y += 6;
  doc.setFillColor(248, 250, 252);
  doc.rect(20, y, pageW - 40, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('DESCRIPTION', 24, y + 5.5);
  doc.text('QTY', 115, y + 5.5, { align: 'center' });
  doc.text('RATE', 142, y + 5.5, { align: 'center' });
  doc.text('AMOUNT', pageW - 24, y + 5.5, { align: 'right' });

  y += 8;
  const items = Array.isArray(invoice.items) && invoice.items.length > 0
    ? invoice.items
    : [{
        description: invoice.description || 'Professional Services',
        quantity: invoice.quantity || 1,
        rate: invoice.rate || invoice.amount || 0,
        amount: invoice.amount || 0
      }];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  items.forEach((item, idx) => {
    const q = Number(item.quantity) || 1;
    const r = Number(item.rate) || 0;
    const lineAmt = item.amount || q * r;

    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(20, y, pageW - 40, 7, 'F');
    }

    doc.text(item.description || 'Service', 24, y + 5);
    doc.text(String(q), 115, y + 5, { align: 'center' });
    doc.text(formatMoney(r), 142, y + 5, { align: 'center' });
    doc.text(formatMoney(lineAmt), pageW - 24, y + 5, { align: 'right' });

    y += 7;
  });

  // Summary Card on Right
  y += 4;
  const sumW = 85;
  const sumX = pageW - 20 - sumW;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.rect(sumX, y, sumW, 36, 'FD');

  let sY = y + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);

  doc.text('Subtotal:', sumX + 6, sY);
  doc.text(formatMoney(invoice.subtotal || invoice.amount), pageW - 24, sY, { align: 'right' });
  sY += 5.5;

  if (Number(invoice.discount) > 0) {
    doc.text(`Discount (${invoice.discount}%):`, sumX + 6, sY);
    doc.text('-' + formatMoney(invoice.discountAmount || 0), pageW - 24, sY, { align: 'right' });
    sY += 5.5;
  }

  if (Number(invoice.tax) > 0) {
    const gstLabel = invoice.gstType === 'inter' ? `IGST (${invoice.tax}%)` : `GST (${invoice.tax}%)`;
    doc.text(gstLabel + ':', sumX + 6, sY);
    doc.text('+' + formatMoney(invoice.taxAmount || 0), pageW - 24, sY, { align: 'right' });
    sY += 5.5;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(sumX + 4, sY, pageW - 24, sY);
  sY += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(22, 163, 74);
  doc.text('AMOUNT PAID:', sumX + 6, sY);
  doc.text(formatMoney(invoice.amount), pageW - 24, sY, { align: 'right' });

  // Thank you note on left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('Thank you for your prompt payment!', 20, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('We appreciate your business and look forward to working with you again.', 20, y + 18);
  doc.text('For queries regarding this receipt, please contact the supplier above.', 20, y + 23);

  // Footer Note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('AutoInvoice • Official Payment Receipt • Computer Generated (No Signature Required)', pageW / 2, pageH - 16, { align: 'center' });

  doc.save(`${receiptNo}_${invoice.client || 'Client'}.pdf`);
  return doc;
}
