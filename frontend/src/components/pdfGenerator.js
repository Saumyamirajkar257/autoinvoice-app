import { jsPDF } from 'jspdf';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import { getText } from '../utils/languages';

/**
 * Universal Multi-Template PDF Generator for AutoInvoice
 * Supports 4 Templates:
 * 1. 'modern'  - Modern Clean with colored accents & sleek typography
 * 2. 'classic' - Classic Corporate with structured boxes & formal styling
 * 3. 'minimal' - Minimalist Elegance with generous whitespace & clean lines
 * 4. 'gst_pro' - Executive Pro structured layout
 */
export function buildInvoicePDFDoc(invoice, userProfile, clientObj, languageOverride, currencyOverride, templateOverride) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const pageH = doc.internal.pageSize.getHeight(); // 297mm

  const p = userProfile || {};
  const c = clientObj || {};

  const lang = languageOverride || invoice?.language || p.language || 'English';
  const t = (key) => getText(key, lang);

  const currencySetting = currencyOverride || invoice?.currency || p.currency || 'INR - Indian Rupee';
  const formatMoney = (val) => formatCurrency(val, currencySetting);
  const currencySymbol = getCurrencySymbol(currencySetting);

  // Normalize and resolve template
  const rawTemplate = String(templateOverride || invoice?.template || p.defaultTemplate || 'modern').toLowerCase().trim();
  let template = 'modern';
  if (rawTemplate.includes('classic')) {
    template = 'classic';
  } else if (rawTemplate.includes('minimal')) {
    template = 'minimal';
  } else if (rawTemplate.includes('gst') || rawTemplate.includes('pro') || rawTemplate.includes('exec')) {
    template = 'gst_pro';
  } else {
    template = 'modern';
  }

  const items = Array.isArray(invoice?.items) && invoice.items.length > 0
    ? invoice.items
    : [{
        description: invoice?.description || 'Professional Service',
        quantity: Number(invoice?.quantity) || 1,
        rate: Number(invoice?.rate) || Number(invoice?.amount) || 0,
        amount: (Number(invoice?.quantity) || 1) * (Number(invoice?.rate) || Number(invoice?.amount) || 0)
      }];

  if (template === 'modern') {
    renderModernTemplate(doc, invoice || {}, p, c, items, t, formatMoney, currencySymbol, currencySetting, pageW, pageH);
  } else if (template === 'classic') {
    renderClassicTemplate(doc, invoice || {}, p, c, items, t, formatMoney, currencySymbol, currencySetting, pageW, pageH);
  } else if (template === 'minimal') {
    renderMinimalTemplate(doc, invoice || {}, p, c, items, t, formatMoney, currencySymbol, currencySetting, pageW, pageH);
  } else {
    renderGSTProTemplate(doc, invoice || {}, p, c, items, t, formatMoney, currencySymbol, currencySetting, pageW, pageH);
  }

  return { doc, template, lang };
}

export function generateInvoicePDF(invoice, userProfile, clientObj, languageOverride, currencyOverride, templateOverride) {
  const { doc, template, lang } = buildInvoicePDFDoc(invoice, userProfile, clientObj, languageOverride, currencyOverride, templateOverride);
  doc.save(`${invoice?.id || 'Invoice'}_${template}_${lang}.pdf`);
  return doc;
}

export function getInvoicePDFBase64(invoice, userProfile, clientObj, languageOverride, currencyOverride, templateOverride) {
  try {
    const { doc } = buildInvoicePDFDoc(invoice, userProfile, clientObj, languageOverride, currencyOverride, templateOverride);
    const dataUri = doc.output('datauristring');
    return dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
  } catch (err) {
    console.warn('PDF base64 generation fallback:', err);
    return null;
  }
}

export function previewInvoicePDF(invoice, userProfile, clientObj, languageOverride, currencyOverride, templateOverride) {
  const { doc } = buildInvoicePDFDoc(invoice, userProfile, clientObj, languageOverride, currencyOverride, templateOverride);
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  try {
    const win = window.open(blobUrl, '_blank');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch (e) {}
      }, 2000);
    }
  } catch (e) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { document.body.removeChild(a); } catch (err) {}
    }, 2000);
  }
  return blobUrl;
}

// ---------------------------------------------------------------------------
// HELPER: RENDER TAX SUMMARY (GST INTRA / INTER OR REGULAR TAX)
// ---------------------------------------------------------------------------
function renderTaxSummaryLines(doc, invoice, formatMoney, startX, startY, rightAlignX) {
  let y = startY;
  const taxPct = Number(invoice.tax) || 0;
  if (taxPct > 0) {
    if (invoice.gstType === 'intra') {
      const halfRate = (taxPct / 2).toFixed(1).replace(/\.0$/, '');
      const halfAmt = (Number(invoice.taxAmount) || 0) / 2;
      doc.text(`CGST (${halfRate}%):`, startX, y);
      doc.text('+' + formatMoney(halfAmt), rightAlignX, y, { align: 'right' });
      y += 5;
      doc.text(`SGST (${halfRate}%):`, startX, y);
      doc.text('+' + formatMoney(halfAmt), rightAlignX, y, { align: 'right' });
      y += 5;
    } else if (invoice.gstType === 'inter') {
      doc.text(`IGST (${taxPct}%):`, startX, y);
      doc.text('+' + formatMoney(invoice.taxAmount), rightAlignX, y, { align: 'right' });
      y += 5;
    } else {
      doc.text(`Tax (${taxPct}%):`, startX, y);
      doc.text('+' + formatMoney(invoice.taxAmount), rightAlignX, y, { align: 'right' });
      y += 5;
    }
  }
  return y;
}

// ---------------------------------------------------------------------------
// HELPER: RENDER MODERN CLEAN TEMPLATE
// ---------------------------------------------------------------------------
function renderModernTemplate(doc, invoice, p, c, items, t, formatMoney, currencySymbol, currencySetting, pageW, pageH) {
  // Top Banner
  doc.setFillColor(37, 99, 235); // #2563eb
  doc.rect(0, 0, pageW, 44, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(t('invoiceTitle'), 18, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Invoice No: ${invoice.id || 'INV-001'}  |  Date: ${invoice.created || 'Today'}`, 18, 32);

  // Business Name on Banner Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(p.businessName || p.fullName || 'AutoInvoice Business', pageW - 18, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let hY = 24;
  if (p.email || p.phone) { doc.text(`${p.email || ''} ${p.phone ? ' | ' + p.phone : ''}`, pageW - 18, hY, { align: 'right' }); hY += 4.5; }
  if (p.businessGstin) { doc.text(`GSTIN: ${p.businessGstin}`, pageW - 18, hY, { align: 'right' }); }

  // Details Section (Bill To & Meta)
  doc.setTextColor(30, 41, 59);
  let y = 54;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BILLED TO:', 18, y);
  doc.text('INVOICE META:', pageW / 2 + 10, y);

  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(invoice.client || c.company || 'Client', 18, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Due Date: ${invoice.due || 'Upon Receipt'}`, pageW / 2 + 10, y);

  y += 5;
  doc.text(`Payment Status: ${(invoice.status || 'SENT').toUpperCase()}`, pageW / 2 + 10, y);
  if (c.contact) { doc.text(`Contact: ${c.contact}`, 18, y); }
  y += 5;

  if (invoice.clientEmail || c.email) { doc.text(`Email: ${invoice.clientEmail || c.email}`, 18, y); }
  if (c.country) { doc.text(`Country: ${c.country}`, pageW / 2 + 10, y); }
  y += 5;
  if (invoice.clientGstin || c.gstin) { doc.text(`GSTIN: ${invoice.clientGstin || c.gstin}`, 18, y); }
  if (invoice.placeOfSupply) { doc.text(`Place of Supply: ${invoice.placeOfSupply}`, pageW / 2 + 10, y); }
  y += 5;

  // Items Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(18, y, pageW - 36, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('DESCRIPTION', 22, y + 5.5);
  doc.text('QTY', 130, y + 5.5, { align: 'center' });
  doc.text(`RATE (${currencySymbol})`, 155, y + 5.5, { align: 'center' });
  doc.text(`AMOUNT (${currencySymbol})`, pageW - 22, y + 5.5, { align: 'right' });

  // Items Rows
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  items.forEach(item => {
    const q = Number(item.quantity) || 1;
    const r = Number(item.rate) || 0;
    doc.text(item.description || 'Service', 22, y);
    doc.text(String(q), 130, y, { align: 'center' });
    doc.text(formatMoney(r), 155, y, { align: 'center' });
    doc.text(formatMoney(q * r), pageW - 22, y, { align: 'right' });
    y += 7;
  });

  // Table Divider Line
  y += 2;
  doc.setDrawColor(226, 232, 240);
  doc.line(18, y, pageW - 18, y);
  y += 6;

  // Financial Summary (Right Side)
  const sumRight = pageW - 22;
  let sumY = y;
  doc.setFontSize(9);
  doc.text('Subtotal:', sumRight - 65, sumY);
  doc.text(formatMoney(invoice.subtotal || invoice.amount), sumRight, sumY, { align: 'right' });
  sumY += 5.5;

  if (Number(invoice.discount) > 0) {
    doc.text(`Discount (${invoice.discount}%):`, sumRight - 65, sumY);
    doc.text('-' + formatMoney(invoice.discountAmount), sumRight, sumY, { align: 'right' });
    sumY += 5.5;
  }

  sumY = renderTaxSummaryLines(doc, invoice, formatMoney, sumRight - 65, sumY, sumRight);

  // Total Box
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(sumRight - 65, sumY, sumRight, sumY);
  sumY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(37, 99, 235);
  doc.text('Total Due:', sumRight - 65, sumY);
  doc.text(formatMoney(invoice.amount), sumRight, sumY, { align: 'right' });

  // Notes Section
  const bottomY = sumY + 12;
  if (invoice.notes) {
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Notes & Terms:', 18, bottomY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(invoice.notes, 160);
    doc.text(lines, 18, bottomY + 5);
  }

  renderFooter(doc, pageW, pageH, 'Modern Clean Template', invoice);
}

// ---------------------------------------------------------------------------
// HELPER: RENDER CLASSIC CORPORATE TEMPLATE
// ---------------------------------------------------------------------------
function renderClassicTemplate(doc, invoice, p, c, items, t, formatMoney, currencySymbol, currencySetting, pageW, pageH) {
  // Border Frame
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.8);
  doc.rect(12, 12, pageW - 24, pageH - 24);

  // Header Box
  doc.setFillColor(15, 23, 42);
  doc.rect(12, 12, pageW - 24, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('INVOICE', 18, 26);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice Ref: ${invoice.id || 'INV-001'}  |  Date: ${invoice.created || 'Today'}`, 18, 34);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(p.businessName || p.fullName || 'AutoInvoice Business', pageW - 18, 24, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  if (p.phone || p.email) doc.text(`${p.phone || ''} ${p.email || ''}`, pageW - 18, 32, { align: 'right' });

  // Two Box Headers (Billed By & Billed To)
  let y = 46;
  doc.setTextColor(15, 23, 42);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);

  // Box 1: Supplier / From
  doc.rect(16, y, 86, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('ISSUED BY:', 20, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(p.businessName || p.fullName || 'Business', 20, y + 10);
  if (p.address) doc.text(doc.splitTextToSize(p.address, 78), 20, y + 14);

  // Box 2: Client / Billed To
  doc.rect(pageW / 2 + 3, y, 86, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('BILLED TO (BUYER):', pageW / 2 + 7, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(invoice.client || c.company || 'Client', pageW / 2 + 7, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let cY = y + 14;
  if (invoice.clientEmail || c.email) { doc.text(`Email: ${invoice.clientEmail || c.email}`, pageW / 2 + 7, cY); }

  // Table Grid with Classic Borders
  y += 32;
  doc.setFillColor(241, 245, 249);
  doc.rect(16, y, pageW - 32, 7, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('#', 19, y + 5);
  doc.text('ITEM / SERVICE DESCRIPTION', 26, y + 5);
  doc.text('QTY', 128, y + 5, { align: 'center' });
  doc.text(`RATE (${currencySymbol})`, 152, y + 5, { align: 'center' });
  doc.text(`TOTAL (${currencySymbol})`, pageW - 20, y + 5, { align: 'right' });

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  items.forEach((item, idx) => {
    const q = Number(item.quantity) || 1;
    const r = Number(item.rate) || 0;
    doc.rect(16, y, pageW - 32, 7);
    doc.text(String(idx + 1), 19, y + 5);
    const descLines = doc.splitTextToSize(String(item.description || 'Item'), 98);
    doc.text(descLines[0] || 'Item', 26, y + 5);
    doc.text(String(q), 128, y + 5, { align: 'center' });
    doc.text(formatMoney(r), 152, y + 5, { align: 'center' });
    doc.text(formatMoney(q * r), pageW - 20, y + 5, { align: 'right' });
    y += 7;
  });

  // Right Side Totals
  y += 4;
  const rightX = pageW / 2 + 3;
  const startTotalsY = y;
  let rY = y + 6;
  doc.setFontSize(8.5);
  doc.text('Subtotal:', rightX + 4, rY);
  doc.text(formatMoney(invoice.subtotal || invoice.amount), pageW - 20, rY, { align: 'right' });
  rY += 5;

  if (Number(invoice.discount) > 0) {
    doc.text(`Discount (${invoice.discount}%):`, rightX + 4, rY);
    doc.text('-' + formatMoney(invoice.discountAmount), pageW - 20, rY, { align: 'right' });
    rY += 5;
  }

  rY = renderTaxSummaryLines(doc, invoice, formatMoney, rightX + 4, rY, pageW - 20);

  doc.setLineWidth(0.4);
  doc.line(rightX, rY, pageW - 16, rY);
  rY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('GRAND TOTAL:', rightX + 4, rY);
  doc.text(formatMoney(invoice.amount), pageW - 20, rY, { align: 'right' });

  const boxHeight = (rY - startTotalsY) + 5;
  doc.rect(rightX, startTotalsY, 86, boxHeight);

  if (invoice.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Terms & Conditions:', 16, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(invoice.notes, 80), 16, y + 11);
  }

  renderFooter(doc, pageW, pageH, 'Classic Corporate Template', invoice);
}

// ---------------------------------------------------------------------------
// HELPER: RENDER MINIMALIST ELEGANCE TEMPLATE
// ---------------------------------------------------------------------------
function renderMinimalTemplate(doc, invoice, p, c, items, t, formatMoney, currencySymbol, currencySetting, pageW, pageH) {
  doc.setTextColor(15, 23, 42);

  // Clean Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('INVOICE', 18, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`#${invoice.id || 'INV-001'}  •  Date: ${invoice.created || 'Today'}  •  Due: ${invoice.due || 'Upon Receipt'}`, 18, 33);

  // Business info top right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(p.businessName || p.fullName || 'Business Name', pageW - 18, 22, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  if (p.email) doc.text(p.email, pageW - 18, 28, { align: 'right' });

  // Minimal Thin Separator Rule
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(18, 38, pageW - 18, 38);

  // Bill to details
  let y = 46;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text('BILLED TO', 18, y);

  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.client || c.company || 'Client', 18, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  y += 4.5;
  if (invoice.clientEmail || c.email) { doc.text(invoice.clientEmail || c.email, 18, y); y += 4.5; }

  // Table
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('ITEM', 18, y);
  doc.text('QTY', 135, y, { align: 'center' });
  doc.text('RATE', 158, y, { align: 'center' });
  doc.text('AMOUNT', pageW - 18, y, { align: 'right' });

  y += 2;
  doc.line(18, y, pageW - 18, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  items.forEach(item => {
    const q = Number(item.quantity) || 1;
    const r = Number(item.rate) || 0;
    doc.text(item.description || 'Service', 18, y);
    doc.text(String(q), 135, y, { align: 'center' });
    doc.text(formatMoney(r), 158, y, { align: 'center' });
    doc.text(formatMoney(q * r), pageW - 18, y, { align: 'right' });
    y += 7;
  });

  doc.line(18, y, pageW - 18, y);
  y += 6;

  // Summary (Right aligned)
  const sumR = pageW - 18;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal:', sumR - 55, y);
  doc.setTextColor(15, 23, 42);
  doc.text(formatMoney(invoice.subtotal || invoice.amount), sumR, y, { align: 'right' });
  y += 5.5;

  if (Number(invoice.discount) > 0) {
    doc.setTextColor(100, 116, 139);
    doc.text(`Discount (${invoice.discount}%):`, sumR - 55, y);
    doc.text('-' + formatMoney(invoice.discountAmount), sumR, y, { align: 'right' });
    y += 5.5;
  }

  y = renderTaxSummaryLines(doc, invoice, formatMoney, sumR - 55, y, sumR);

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Total:', sumR - 55, y + 4);
  doc.text(formatMoney(invoice.amount), sumR, y + 4, { align: 'right' });

  if (invoice.notes) {
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Notes & Terms:', 18, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(String(invoice.notes || ''), 160);
    doc.text(lines, 18, y + 4.5);
  }

  renderFooter(doc, pageW, pageH, 'Minimalist Elegance Template', invoice);
}

// ---------------------------------------------------------------------------
// HELPER: RENDER EXECUTIVE PRO TEMPLATE
// ---------------------------------------------------------------------------
function renderGSTProTemplate(doc, invoice, p, c, items, t, formatMoney, currencySymbol, currencySetting, pageW, pageH) {
  // Formal Border
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.5);
  doc.rect(14, 14, pageW - 28, pageH - 28);

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('INVOICE', pageW / 2, 24, { align: 'center' });

  doc.line(14, 29, pageW - 14, 29);

  // Supplier & Invoice details grid
  let y = 35;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Supplier: ${p.businessName || p.fullName || 'Business'}`, 18, y);
  doc.text(`Invoice No: ${invoice.id || 'INV-001'}`, pageW / 2 + 5, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Invoice Date: ${invoice.created || 'Today'}`, 18, y);
  doc.text(`Due Date: ${invoice.due || 'Upon Receipt'}`, pageW / 2 + 5, y);

  doc.line(14, y + 4, pageW - 14, y + 4);

  // Buyer Details
  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Recipient (Billed To): ${invoice.client || c.company || 'Client'}`, 18, y);
  doc.text(`Country: ${c.country || 'India'}`, pageW / 2 + 5, y);

  doc.line(14, y + 4, pageW - 14, y + 4);

  // Items Table Header
  y += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pageW - 28, 7, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DESCRIPTION', 18, y + 4.5);
  doc.text('QTY', 115, y + 4.5, { align: 'center' });
  doc.text('RATE', 140, y + 4.5, { align: 'center' });
  doc.text('TOTAL', pageW - 18, y + 4.5, { align: 'right' });

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  items.forEach(item => {
    const q = Number(item.quantity) || 1;
    const r = Number(item.rate) || 0;
    const lineTotal = q * r;
    doc.line(14, y, pageW - 14, y);
    const descLines = doc.splitTextToSize(String(item.description || 'Service'), 92);
    doc.text(descLines[0] || 'Service', 18, y + 4.5);
    doc.text(String(q), 115, y + 4.5, { align: 'center' });
    doc.text(formatMoney(r), 140, y + 4.5, { align: 'center' });
    doc.text(formatMoney(lineTotal), pageW - 18, y + 4.5, { align: 'right' });
    y += 6.5;
  });

  doc.line(14, y, pageW - 14, y);

  // Summary Table on Right
  y += 4;
  const rightX = pageW / 2 + 5;
  const startTotalsY = y;
  let rY = y + 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Subtotal:', rightX + 4, rY);
  doc.text(formatMoney(invoice.subtotal || invoice.amount), pageW - 18, rY, { align: 'right' });
  rY += 5;

  if (Number(invoice.discount) > 0) {
    doc.text(`Discount (${invoice.discount}%):`, rightX + 4, rY);
    doc.text('-' + formatMoney(invoice.discountAmount), pageW - 18, rY, { align: 'right' });
    rY += 5;
  }

  rY = renderTaxSummaryLines(doc, invoice, formatMoney, rightX + 4, rY, pageW - 18);

  doc.line(rightX, rY + 1, pageW - 14, rY + 1);
  rY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL AMOUNT:', rightX + 4, rY);
  doc.text(formatMoney(invoice.amount), pageW - 18, rY, { align: 'right' });

  const boxHeight = (rY - startTotalsY) + 4;
  doc.rect(rightX, startTotalsY, 83, boxHeight);

  if (invoice.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Notes:', 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(String(invoice.notes || ''), 80), 18, y + 11);
  }

  renderFooter(doc, pageW, pageH, 'Executive Pro Template', invoice);
}

// ---------------------------------------------------------------------------
// HELPER: RENDER FOOTER
// ---------------------------------------------------------------------------
function renderFooter(doc, pageW, pageH, templateName, invoice) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`AutoInvoice • ${templateName} • Computer Generated Invoice`, pageW / 2, pageH - 10, { align: 'center' });
  doc.setTextColor(37, 99, 235);
  const baseUrl = typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : 'https://autoinvoice-app.com';
  const payUrl = `${baseUrl}/#/pay/${encodeURIComponent(invoice?.id || 'INV-001')}`;
  doc.text(`Scan & Pay Online: ${payUrl}`, pageW / 2, pageH - 6, { align: 'center' });
}
