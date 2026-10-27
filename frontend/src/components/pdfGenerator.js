import { jsPDF } from 'jspdf';
import { formatCurrency, getCurrencySymbol, getCurrencyCode } from '../utils/currency.js';
import { getText } from '../utils/languages.js';
import { amountInWords } from '../utils/numberToWords.js';

/**
 * World-Class Multi-Template, Multi-Page PDF Invoice Generator for AutoInvoice
 * Supports 4 High-End Commercial SaaS Templates:
 * 1. 'gst_pro' - Executive Statutory Tax Invoice (HSN summary, CGST/SGST/IGST, Bank Details, Signatory)
 * 2. 'modern'  - Modern Clean SaaS (Vibrant indigo accents, sleek typography, card styling)
 * 3. 'classic' - Classic Corporate (Formal boxed sections, navy header, structured layout)
 * 4. 'minimal' - Minimalist Elegance (Airy whitespace, high contrast, clean typography)
 */

export function buildInvoicePDFDoc(invoice, userProfile, clientObj, languageOverride, currencyOverride, templateOverride) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const pageH = doc.internal.pageSize.getHeight(); // 297mm

  const p = userProfile || {};
  const c = clientObj || {};
  const inv = invoice || {};

  const lang = languageOverride || inv.language || p.language || 'English';
  const t = (key) => getText(key, lang);

  const currencySetting = currencyOverride || inv.currency || p.currency || 'INR - Indian Rupee';
  const currencyCode = getCurrencyCode(currencySetting);
  const currencySymbol = currencyCode === 'INR' ? 'Rs.' : getCurrencySymbol(currencySetting);
  const formatMoney = (val) => formatCurrency(val, currencySetting).replace(/₹/g, 'Rs. ');

  // Normalize template
  const rawTemplate = String(templateOverride || inv.template || p.defaultTemplate || 'modern').toLowerCase().trim();
  let template = 'modern';
  if (rawTemplate.includes('gst') || rawTemplate.includes('pro') || rawTemplate.includes('exec')) {
    template = 'gst_pro';
  } else if (rawTemplate.includes('classic')) {
    template = 'classic';
  } else if (rawTemplate.includes('minimal')) {
    template = 'minimal';
  } else {
    template = 'modern';
  }

  // Items extraction
  const rawItems = Array.isArray(inv.items) && inv.items.length > 0
    ? inv.items
    : [{
        description: inv.description || 'Professional Consultation & Technical Services',
        hsnSac: inv.hsnSac || '998314',
        quantity: Number(inv.quantity) || 1,
        unit: 'Units',
        rate: Number(inv.rate) || Number(inv.amount) || 0,
        amount: (Number(inv.quantity) || 1) * (Number(inv.rate) || Number(inv.amount) || 0)
      }];

  const items = rawItems.map((item, index) => {
    const q = Number(item.quantity) || 1;
    const r = Number(item.rate) || 0;
    const lineAmt = item.amount !== undefined ? Number(item.amount) : (q * r);
    return {
      sNo: index + 1,
      description: item.description || `Item #${index + 1}`,
      hsnSac: item.hsnSac || inv.hsnSac || '',
      quantity: q,
      unit: item.unit || 'Nos',
      rate: r,
      amount: lineAmt
    };
  });

  // Calculate financials safely
  const grossSubtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const discountPct = Number(inv.discount) || 0;
  const discountAmount = inv.discountAmount !== undefined ? Number(inv.discountAmount) : ((grossSubtotal * discountPct) / 100);
  const taxableAmount = Math.max(0, grossSubtotal - discountAmount);

  const taxPct = Number(inv.tax) || 0;
  const isGst = Boolean(inv.gstEnabled || inv.gstType || p.businessGstin || c.gstin);
  const gstType = inv.gstType || (p.stateName && c.country === 'India' && p.stateName.toLowerCase() === (c.stateName || p.stateName).toLowerCase() ? 'intra' : 'inter');

  let cgstRate = 0, sgstRate = 0, igstRate = 0;
  let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

  if (taxPct > 0) {
    if (gstType === 'intra') {
      cgstRate = taxPct / 2;
      sgstRate = taxPct / 2;
      cgstAmount = (taxableAmount * cgstRate) / 100;
      sgstAmount = (taxableAmount * sgstRate) / 100;
    } else {
      igstRate = taxPct;
      igstAmount = (taxableAmount * igstRate) / 100;
    }
  }

  const calculatedTaxAmount = taxPct > 0 ? (cgstAmount + sgstAmount + igstAmount) : 0;
  const shippingCharges = Number(inv.shippingCharges || 0);
  const rawGrandTotal = taxableAmount + calculatedTaxAmount + shippingCharges;
  const grandTotal = Number((inv.amount !== undefined ? Number(inv.amount) : rawGrandTotal).toFixed(2));
  const roundOff = Number((grandTotal - rawGrandTotal).toFixed(2));

  // Payment tracking
  const amountPaid = Number(inv.amountPaid !== undefined ? inv.amountPaid : (inv.status === 'paid' ? grandTotal : 0));
  const balanceDue = Math.max(0, Number((grandTotal - amountPaid).toFixed(2)));

  const computedData = {
    grossSubtotal,
    discountPct,
    discountAmount,
    taxableAmount,
    taxPct,
    isGst,
    gstType,
    cgstRate,
    sgstRate,
    igstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    calculatedTaxAmount,
    shippingCharges,
    roundOff,
    grandTotal,
    amountPaid,
    balanceDue,
    words: amountInWords(grandTotal, currencySetting)
  };

  // Render according to selected template
  if (template === 'gst_pro') {
    renderGSTProTemplate(doc, inv, p, c, items, computedData, t, formatMoney, currencySymbol, pageW, pageH);
  } else if (template === 'classic') {
    renderClassicTemplate(doc, inv, p, c, items, computedData, t, formatMoney, currencySymbol, pageW, pageH);
  } else if (template === 'minimal') {
    renderMinimalTemplate(doc, inv, p, c, items, computedData, t, formatMoney, currencySymbol, pageW, pageH);
  } else {
    renderModernTemplate(doc, inv, p, c, items, computedData, t, formatMoney, currencySymbol, pageW, pageH);
  }

  return { doc, template, lang };
}

export function generateInvoicePDF(invoice, userProfile, clientObj, languageOverride, currencyOverride, templateOverride) {
  const { doc, template, lang } = buildInvoicePDFDoc(invoice, userProfile, clientObj, languageOverride, currencyOverride, templateOverride);
  const filename = `${invoice?.id || 'Invoice'}_${template}_${lang}.pdf`;
  doc.save(filename);
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
      setTimeout(() => { try { document.body.removeChild(a); } catch (e) {} }, 2000);
    }
  } catch (e) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { document.body.removeChild(a); } catch (err) {} }, 2000);
  }
  return blobUrl;
}

// ===========================================================================
// TEMPLATE 1: EXECUTIVE STATUTORY TAX INVOICE (GST PRO)
// ===========================================================================
function renderGSTProTemplate(doc, inv, p, c, items, data, t, formatMoney, sym, pageW, pageH) {
  let curPage = 1;
  const leftX = 14;
  const rightX = pageW - 14;
  const contentW = rightX - leftX;

  // Outer framing
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.rect(leftX, 12, contentW, pageH - 24);

  // Top Title Bar
  doc.setFillColor(30, 41, 59);
  doc.rect(leftX, 12, contentW, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('TAX INVOICE', pageW / 2, 18.5, { align: 'center' });

  let y = 26;

  // Header Section: Supplier (Left) & Invoice Meta (Right)
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);

  const businessTitle = p.businessName || p.fullName || 'AutoInvoice Business';
  doc.text(businessTitle, leftX + 4, y);

  // Render Logo if present
  if (p.logo && p.logo.startsWith('data:image')) {
    try {
      doc.addImage(p.logo, 'PNG', rightX - 35, y - 3, 30, 14);
    } catch (e) {
      // Ignored if image format unsupported
    }
  }

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  if (p.address) {
    const addrLines = doc.splitTextToSize(p.address, 95);
    doc.text(addrLines, leftX + 4, y);
    y += (addrLines.length * 4);
  }
  const stateStr = `${p.stateName || 'Maharashtra'}${p.country ? ', ' + p.country : ''}`;
  doc.text(stateStr, leftX + 4, y);
  y += 4;
  if (p.email || p.phone) {
    doc.text(`Email: ${p.email || ''} | Phone: ${p.phone || ''}`, leftX + 4, y);
    y += 4;
  }
  if (p.businessGstin || p.gstin) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`GSTIN: ${p.businessGstin || p.gstin}`, leftX + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    y += 4;
  }
  if (p.pan) {
    doc.text(`PAN: ${p.pan}`, leftX + 4, y);
    y += 4;
  }

  // Invoice Meta Box (Right Side)
  const metaBoxX = pageW / 2 + 6;
  let metaY = 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Invoice No:`, metaBoxX, metaY);
  doc.setTextColor(37, 99, 235);
  doc.text(inv.id || 'INV-001', metaBoxX + 28, metaY);

  metaY += 4.5;
  doc.setTextColor(15, 23, 42);
  doc.text(`Invoice Date:`, metaBoxX, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(inv.created || 'Today', metaBoxX + 28, metaY);

  metaY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Due Date:`, metaBoxX, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(inv.due || 'Upon Receipt', metaBoxX + 28, metaY);

  metaY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Place of Supply:`, metaBoxX, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(inv.placeOfSupply || p.stateName || 'State', metaBoxX + 28, metaY);

  metaY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Reverse Charge:`, metaBoxX, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(inv.reverseCharge ? 'Yes' : 'No', metaBoxX + 28, metaY);

  metaY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Status:`, metaBoxX, metaY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(inv.status === 'paid' ? 22 : (inv.status === 'overdue' ? 220 : 37), inv.status === 'paid' ? 163 : 99, inv.status === 'paid' ? 74 : 235);
  doc.text((inv.status || 'SENT').toUpperCase(), metaBoxX + 28, metaY);

  y = Math.max(y, metaY) + 3;

  // Horizontal divider
  doc.setDrawColor(203, 213, 225);
  doc.line(leftX, y, rightX, y);
  y += 4;

  // Bill To (Customer) Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('DETAILS OF RECEIVER / BILLED TO:', leftX + 4, y);
  y += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(inv.client || c.company || 'Client Name', leftX + 4, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  if (c.address) {
    const clientAddr = doc.splitTextToSize(c.address, 110);
    doc.text(clientAddr, leftX + 4, y);
    y += (clientAddr.length * 3.8);
  }
  if (c.contact || inv.clientEmail || c.email) {
    doc.text(`Contact: ${c.contact || 'Representative'} | Email: ${inv.clientEmail || c.email || 'N/A'}`, leftX + 4, y);
    y += 4;
  }
  if (c.phone) {
    doc.text(`Phone: ${c.phone}`, leftX + 4, y);
    y += 4;
  }
  if (inv.clientGstin || c.gstin) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Client GSTIN: ${inv.clientGstin || c.gstin}`, leftX + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    y += 4;
  }

  y += 2;
  doc.line(leftX, y, rightX, y);

  // Table Headers
  const colX = {
    sNo: leftX + 2,
    desc: leftX + 12,
    hsn: leftX + 85,
    qty: leftX + 107,
    unit: leftX + 120,
    rate: leftX + 138,
    amount: rightX - 4
  };

  const drawTableHeader = (atY) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(leftX, atY, contentW, 7, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('#', colX.sNo, atY + 4.8);
    doc.text('DESCRIPTION OF GOODS / SERVICES', colX.desc, atY + 4.8);
    doc.text('HSN/SAC', colX.hsn, atY + 4.8);
    doc.text('QTY', colX.qty, atY + 4.8, { align: 'center' });
    doc.text('UNIT', colX.unit, atY + 4.8, { align: 'center' });
    doc.text(`RATE (${sym})`, colX.rate, atY + 4.8, { align: 'right' });
    doc.text(`AMOUNT (${sym})`, colX.amount, atY + 4.8, { align: 'right' });
  };

  drawTableHeader(y);
  y += 7;

  // Item Rows with Automatic Multi-Page Overflow
  items.forEach((item) => {
    // Check if row exceeds safe bottom
    if (y > pageH - 85) {
      doc.addPage();
      curPage++;
      // Outer border on new page
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.4);
      doc.rect(leftX, 12, contentW, pageH - 24);
      y = 16;
      drawTableHeader(y);
      y += 7;
    }

    doc.line(leftX, y, rightX, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    const descLines = doc.splitTextToSize(item.description, 70);
    const rowHeight = Math.max(6, descLines.length * 3.8 + 2);

    doc.text(String(item.sNo), colX.sNo, y + 4);
    doc.text(descLines, colX.desc, y + 4);
    doc.text(item.hsnSac || '-', colX.hsn, y + 4);
    doc.text(String(item.quantity), colX.qty, y + 4, { align: 'center' });
    doc.text(item.unit || 'Nos', colX.unit, y + 4, { align: 'center' });
    doc.text(formatMoney(item.rate), colX.rate, y + 4, { align: 'right' });
    doc.text(formatMoney(item.amount), colX.amount, y + 4, { align: 'right' });

    y += rowHeight;
  });

  doc.line(leftX, y, rightX, y);

  // Financial Breakdown Box (Right) & Notes / Banking (Left)
  if (y > pageH - 75) {
    doc.addPage();
    curPage++;
    doc.rect(leftX, 12, contentW, pageH - 24);
    y = 16;
  }

  const breakdownX = pageW / 2 + 10;
  const breakdownW = rightX - breakdownX;
  let bY = y + 4;

  // Left Side: Amount in Words & Bank Details
  let leftY = y + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('AMOUNT CHARGEABLE (IN WORDS):', leftX + 4, leftY);
  leftY += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const wordsLines = doc.splitTextToSize(data.words, pageW / 2 - 20);
  doc.text(wordsLines, leftX + 4, leftY);
  leftY += (wordsLines.length * 4) + 4;

  // Banking Details Box
  if (p.bankName || p.accountNumber || p.upiId) {
    doc.setFillColor(248, 250, 252);
    doc.rect(leftX + 4, leftY, pageW / 2 - 20, 26, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('BANK & PAYMENT DETAILS:', leftX + 8, leftY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    let bankLineY = leftY + 9;
    if (p.bankName) { doc.text(`Bank: ${p.bankName}`, leftX + 8, bankLineY); bankLineY += 3.8; }
    if (p.accountNumber) { doc.text(`A/C No: ${p.accountNumber}`, leftX + 8, bankLineY); bankLineY += 3.8; }
    if (p.ifscCode) { doc.text(`IFSC: ${p.ifscCode} ${p.branch ? '| Branch: ' + p.branch : ''}`, leftX + 8, bankLineY); bankLineY += 3.8; }
    if (p.upiId) { doc.text(`UPI VPA: ${p.upiId}`, leftX + 8, bankLineY); }
    leftY += 30;
  }

  // Terms & Conditions
  if (inv.notes || p.defaultTerms) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('DECLARATION / TERMS:', leftX + 4, leftY);
    leftY += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const terms = inv.notes || p.defaultTerms || 'Payment is requested via bank transfer or UPI within the stated terms.';
    doc.text(doc.splitTextToSize(terms, pageW / 2 - 20), leftX + 4, leftY);
  }

  // Right Side: Detailed Mathematical Breakdown
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const drawRow = (label, val, isBold = false, isAccent = false) => {
    if (isBold) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal');
    if (isAccent) doc.setTextColor(37, 99, 235); else doc.setTextColor(15, 23, 42);
    doc.text(label, breakdownX, bY);
    doc.text(val, rightX - 4, bY, { align: 'right' });
    bY += 4.5;
  };

  drawRow('Subtotal (Gross):', formatMoney(data.grossSubtotal));

  if (data.discountAmount > 0) {
    drawRow(`Discount (${data.discountPct}%):`, '-' + formatMoney(data.discountAmount));
    drawRow('Taxable Value:', formatMoney(data.taxableAmount));
  }

  if (data.taxPct > 0) {
    if (data.gstType === 'intra') {
      drawRow(`CGST (${data.cgstRate}%):`, '+' + formatMoney(data.cgstAmount));
      drawRow(`SGST (${data.sgstRate}%):`, '+' + formatMoney(data.sgstAmount));
    } else {
      drawRow(`IGST (${data.igstRate}%):`, '+' + formatMoney(data.igstAmount));
    }
  }

  if (data.shippingCharges > 0) {
    drawRow('Shipping & Handling:', '+' + formatMoney(data.shippingCharges));
  }

  if (Math.abs(data.roundOff) > 0) {
    drawRow('Round Off:', (data.roundOff >= 0 ? '+' : '') + formatMoney(data.roundOff));
  }

  // Grand Total Line
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.line(breakdownX, bY, rightX, bY);
  bY += 5;
  drawRow('GRAND TOTAL:', formatMoney(data.grandTotal), true, true);

  // Partial Payment and Outstanding Balance
  if (data.amountPaid > 0) {
    drawRow('Amount Received / Paid:', '-' + formatMoney(data.amountPaid));
    drawRow('BALANCE DUE:', formatMoney(data.balanceDue), true);
  }

  // Signatory Box on bottom right
  const sigY = pageH - 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`For ${businessTitle}:`, rightX - 55, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Signatory', rightX - 55, sigY + 12);
  doc.line(rightX - 55, sigY + 10, rightX - 4, sigY + 10);

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('AutoInvoice Pro • Computer Generated Tax Invoice', pageW / 2, pageH - 8, { align: 'center' });
}

// ===========================================================================
// TEMPLATE 2: MODERN CLEAN SAAS TEMPLATE
// ===========================================================================
function renderModernTemplate(doc, inv, p, c, items, data, t, formatMoney, sym, pageW, pageH) {
  const margin = 16;
  const contentW = pageW - margin * 2;

  // Header Gradient Banner
  doc.setFillColor(37, 99, 235); // Modern Indigo
  doc.rect(0, 0, pageW, 42, 'F');

  // Title on Left
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(t('invoiceTitle') || 'INVOICE', margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Invoice #${inv.id || 'INV-001'}  •  Date: ${inv.created || 'Today'}  •  Due: ${inv.due || 'Upon Receipt'}`, margin, 29);

  // Business Name on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(p.businessName || p.fullName || 'AutoInvoice Business', pageW - margin, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  let bY = 24;
  if (p.email) { doc.text(p.email, pageW - margin, bY, { align: 'right' }); bY += 4.2; }
  if (p.phone) { doc.text(p.phone, pageW - margin, bY, { align: 'right' }); bY += 4.2; }
  if (p.businessGstin) { doc.text(`GSTIN: ${p.businessGstin}`, pageW - margin, bY, { align: 'right' }); }

  // Details Section
  let y = 52;
  doc.setTextColor(15, 23, 42);

  // Billed To (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('BILLED TO', margin, y);

  doc.text('PAYMENT DETAILS', pageW / 2 + 10, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(inv.client || c.company || 'Client', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Status: ${(inv.status || 'SENT').toUpperCase()}`, pageW / 2 + 10, y);
  y += 4.8;

  if (c.contact) { doc.text(`Contact: ${c.contact}`, margin, y); }
  if (p.upiId) { doc.text(`UPI ID: ${p.upiId}`, pageW / 2 + 10, y); }
  y += 4.5;

  if (inv.clientEmail || c.email) { doc.text(`Email: ${inv.clientEmail || c.email}`, margin, y); }
  if (inv.placeOfSupply) { doc.text(`Place of Supply: ${inv.placeOfSupply}`, pageW / 2 + 10, y); }
  y += 4.5;

  if (inv.clientGstin || c.gstin) { doc.text(`Client GSTIN: ${inv.clientGstin || c.gstin}`, margin, y); }
  y += 6;

  // Items Table Header
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, contentW, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('ITEM & DESCRIPTION', margin + 6, y + 5.5);
  doc.text('QTY', pageW - margin - 85, y + 5.5, { align: 'center' });
  doc.text(`RATE (${sym})`, pageW - margin - 50, y + 5.5, { align: 'right' });
  doc.text(`TOTAL (${sym})`, pageW - margin - 6, y + 5.5, { align: 'right' });
  y += 11;

  // Item Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);

  items.forEach((item, idx) => {
    if (y > pageH - 75) {
      doc.addPage();
      y = 20;
    }

    const descLines = doc.splitTextToSize(item.description, 95);
    doc.text(descLines, margin + 6, y);
    doc.text(String(item.quantity), pageW - margin - 85, y, { align: 'center' });
    doc.text(formatMoney(item.rate), pageW - margin - 50, y, { align: 'right' });
    doc.text(formatMoney(item.amount), pageW - margin - 6, y, { align: 'right' });

    y += Math.max(7, descLines.length * 4 + 3);
  });

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Summary Card on Right
  const sumW = 88;
  const sumX = pageW - margin - sumW;
  let sumY = y;

  const renderSumRow = (label, val, isBold = false, isAccent = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 9.5 : 8.5);
    doc.setTextColor(isAccent ? 37 : (isBold ? 15 : 71), isAccent ? 99 : (isBold ? 23 : 85), isAccent ? 235 : (isBold ? 42 : 105));
    doc.text(label, sumX, sumY);
    doc.text(val, pageW - margin - 4, sumY, { align: 'right' });
    sumY += 5;
  };

  renderSumRow('Subtotal:', formatMoney(data.grossSubtotal));
  if (data.discountAmount > 0) renderSumRow(`Discount (${data.discountPct}%):`, '-' + formatMoney(data.discountAmount));
  if (data.taxPct > 0) {
    if (data.gstType === 'intra') {
      renderSumRow(`CGST (${data.cgstRate}%):`, '+' + formatMoney(data.cgstAmount));
      renderSumRow(`SGST (${data.sgstRate}%):`, '+' + formatMoney(data.sgstAmount));
    } else {
      renderSumRow(`Tax / IGST (${data.taxPct}%):`, '+' + formatMoney(data.calculatedTaxAmount));
    }
  }
  if (data.shippingCharges > 0) renderSumRow('Shipping:', '+' + formatMoney(data.shippingCharges));

  doc.setDrawColor(37, 99, 235);
  doc.line(sumX, sumY, pageW - margin - 2, sumY);
  sumY += 6;
  renderSumRow('Total Amount Due:', formatMoney(data.grandTotal), true, true);

  if (data.amountPaid > 0) {
    renderSumRow('Amount Paid:', '-' + formatMoney(data.amountPaid));
    renderSumRow('Remaining Balance:', formatMoney(data.balanceDue), true);
  }

  // Notes on left
  if (inv.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Notes & Terms:', margin, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(inv.notes, 85), margin, y + 7);
  }

  // Amount in words
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`In Words: ${data.words}`, margin, pageH - 18);

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('AutoInvoice • Modern Clean Template • Electronic Billing', pageW / 2, pageH - 10, { align: 'center' });
}

// ===========================================================================
// TEMPLATE 3: CLASSIC CORPORATE TEMPLATE
// ===========================================================================
function renderClassicTemplate(doc, inv, p, c, items, data, t, formatMoney, sym, pageW, pageH) {
  const margin = 14;
  const contentW = pageW - margin * 2;

  // Frame Border
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.rect(margin, 12, contentW, pageH - 24);

  // Top Box
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, 12, contentW, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('INVOICE', margin + 8, 25);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice Ref: ${inv.id || 'INV-001'}  |  Date: ${inv.created || 'Today'}  |  Due: ${inv.due || 'Upon Receipt'}`, margin + 8, 33);

  // Business Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(p.businessName || p.fullName || 'Corporate Billing', pageW - margin - 8, 24, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (p.email || p.phone) doc.text(`${p.email || ''} ${p.phone ? '| ' + p.phone : ''}`, pageW - margin - 8, 31, { align: 'right' });

  // Two Boxes (Issuer & Recipient)
  let y = 44;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);

  // Left Box: Issuer
  doc.rect(margin + 4, y, contentW / 2 - 6, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('ISSUED BY:', margin + 8, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(p.businessName || p.fullName || 'Business', margin + 8, y + 10);
  if (p.address) doc.text(doc.splitTextToSize(p.address, contentW / 2 - 14), margin + 8, y + 14);

  // Right Box: Recipient
  const rBoxX = pageW / 2 + 2;
  doc.rect(rBoxX, y, contentW / 2 - 6, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('BILLED TO (BUYER):', rBoxX + 4, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(inv.client || c.company || 'Client', rBoxX + 4, y + 10);
  doc.setFont('helvetica', 'normal');
  if (inv.clientEmail || c.email) doc.text(`Email: ${inv.clientEmail || c.email}`, rBoxX + 4, y + 15);
  if (inv.clientGstin || c.gstin) doc.text(`GSTIN: ${inv.clientGstin || c.gstin}`, rBoxX + 4, y + 19);

  y += 32;

  // Table
  doc.setFillColor(241, 245, 249);
  doc.rect(margin + 4, y, contentW - 8, 7, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('#', margin + 8, y + 4.8);
  doc.text('DESCRIPTION OF GOODS / SERVICES', margin + 18, y + 4.8);
  doc.text('QTY', pageW - margin - 80, y + 4.8, { align: 'center' });
  doc.text(`RATE (${sym})`, pageW - margin - 48, y + 4.8, { align: 'right' });
  doc.text(`TOTAL (${sym})`, pageW - margin - 8, y + 4.8, { align: 'right' });
  y += 7;

  items.forEach((item, idx) => {
    if (y > pageH - 75) {
      doc.addPage();
      doc.rect(margin, 12, contentW, pageH - 24);
      y = 20;
    }

    doc.rect(margin + 4, y, contentW - 8, 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(String(idx + 1), margin + 8, y + 4.8);
    const desc = doc.splitTextToSize(item.description, 85);
    doc.text(desc[0] || 'Item', margin + 18, y + 4.8);
    doc.text(String(item.quantity), pageW - margin - 80, y + 4.8, { align: 'center' });
    doc.text(formatMoney(item.rate), pageW - margin - 48, y + 4.8, { align: 'right' });
    doc.text(formatMoney(item.amount), pageW - margin - 8, y + 4.8, { align: 'right' });
    y += 7;
  });

  // Totals Box (Right)
  y += 4;
  const totW = 86;
  const totX = pageW - margin - 4 - totW;
  let tY = y + 5;

  doc.setFontSize(8.5);
  doc.text('Subtotal:', totX + 4, tY);
  doc.text(formatMoney(data.grossSubtotal), pageW - margin - 8, tY, { align: 'right' });
  tY += 4.8;

  if (data.discountAmount > 0) {
    doc.text(`Discount (${data.discountPct}%):`, totX + 4, tY);
    doc.text('-' + formatMoney(data.discountAmount), pageW - margin - 8, tY, { align: 'right' });
    tY += 4.8;
  }

  if (data.taxPct > 0) {
    doc.text(`Tax (${data.taxPct}%):`, totX + 4, tY);
    doc.text('+' + formatMoney(data.calculatedTaxAmount), pageW - margin - 8, tY, { align: 'right' });
    tY += 4.8;
  }

  doc.setLineWidth(0.4);
  doc.line(totX, tY, pageW - margin - 4, tY);
  tY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL AMOUNT:', totX + 4, tY);
  doc.text(formatMoney(data.grandTotal), pageW - margin - 8, tY, { align: 'right' });

  doc.rect(totX, y, totW, (tY - y) + 4);

  // Left terms
  if (inv.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Terms & Conditions:', margin + 4, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(inv.notes, 75), margin + 4, y + 9);
  }

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Classic Corporate • Official Computer Generated Invoice', pageW / 2, pageH - 16, { align: 'center' });
}

// ===========================================================================
// TEMPLATE 4: MINIMALIST ELEGANCE TEMPLATE
// ===========================================================================
function renderMinimalTemplate(doc, inv, p, c, items, data, t, formatMoney, sym, pageW, pageH) {
  const margin = 18;
  doc.setTextColor(15, 23, 42);

  // Top Clean Minimal Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('INVOICE', margin, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`#${inv.id || 'INV-001'}  •  ${inv.created || 'Today'}  •  Due ${inv.due || 'Upon Receipt'}`, margin, 33);

  // Business on Top Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(p.businessName || p.fullName || 'Business Name', pageW - margin, 24, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  if (p.email) doc.text(p.email, pageW - margin, 30, { align: 'right' });

  // Minimal Thin Rule
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, 38, pageW - margin, 38);

  // Client Details
  let y = 46;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('BILLED TO', margin, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(inv.client || c.company || 'Client', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  y += 4.5;
  if (inv.clientEmail || c.email) { doc.text(inv.clientEmail || c.email, margin, y); y += 4.5; }

  // Clean Table
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('ITEM', margin, y);
  doc.text('QTY', pageW - margin - 80, y, { align: 'center' });
  doc.text('RATE', pageW - margin - 45, y, { align: 'right' });
  doc.text('AMOUNT', pageW - margin, y, { align: 'right' });

  y += 2;
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  items.forEach(item => {
    if (y > pageH - 65) {
      doc.addPage();
      y = 20;
    }
    doc.text(item.description, margin, y);
    doc.text(String(item.quantity), pageW - margin - 80, y, { align: 'center' });
    doc.text(formatMoney(item.rate), pageW - margin - 45, y, { align: 'right' });
    doc.text(formatMoney(item.amount), pageW - margin, y, { align: 'right' });
    y += 7;
  });

  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Summary
  const sumR = pageW - margin;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal:', sumR - 55, y);
  doc.setTextColor(15, 23, 42);
  doc.text(formatMoney(data.grossSubtotal), sumR, y, { align: 'right' });
  y += 5.5;

  if (data.discountAmount > 0) {
    doc.setTextColor(100, 116, 139);
    doc.text(`Discount (${data.discountPct}%):`, sumR - 55, y);
    doc.text('-' + formatMoney(data.discountAmount), sumR, y, { align: 'right' });
    y += 5.5;
  }

  if (data.taxPct > 0) {
    doc.setTextColor(100, 116, 139);
    doc.text(`Tax (${data.taxPct}%):`, sumR - 55, y);
    doc.text('+' + formatMoney(data.calculatedTaxAmount), sumR, y, { align: 'right' });
    y += 5.5;
  }

  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Total Due:', sumR - 55, y);
  doc.text(formatMoney(data.grandTotal), sumR, y, { align: 'right' });

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Minimalist Elegance • Computer Generated Document', pageW / 2, pageH - 12, { align: 'center' });
}
