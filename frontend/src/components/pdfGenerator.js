import { jsPDF } from 'jspdf';
import { formatCurrency } from '../utils/currency';
import { getText } from '../utils/languages';

export function generateInvoicePDF(invoice, userProfile, clientObj, languageOverride, currencyOverride) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const p = userProfile || {};
  const c = clientObj || {};

  const lang = languageOverride || invoice.language || p.language || 'English';
  const t = (key) => getText(key, lang);

  const currencySetting = currencyOverride || invoice.currency || p.currency || 'INR - Indian Rupee';
  const formatMoney = (val) => formatCurrency(val, currencySetting);

  // Top header banner background (Primary Blue)
  doc.setFillColor(37, 99, 235); // #2563eb
  doc.rect(0, 0, pageW, 46, 'F');

  // Title on Header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(t('invoiceTitle'), 20, 24);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.id || 'INV-001', 20, 34);

  // Business info on Right side of Header
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(p.businessName || p.fullName || 'AutoInvoice Business', pageW - 20, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  if (p.address) doc.text(p.address, pageW - 20, 24, { align: 'right' });
  if (p.phone) doc.text('Phone: ' + p.phone, pageW - 20, 30, { align: 'right' });
  if (p.website) doc.text(p.website, pageW - 20, 36, { align: 'right' });

  // Reset text color for body
  doc.setTextColor(30, 41, 59);

  // Bill To & Invoice Meta Details
  let y = 60;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(t('billTo'), 20, y);
  doc.text(t('invoiceDetails'), pageW / 2 + 10, y);

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  // Bill To content
  doc.text(invoice.client || c.company || 'Client', 20, y);
  doc.text(`${t('invoiceNo')}  ${invoice.id || ''}`, pageW / 2 + 10, y);
  y += 6;
  if (c.contact) doc.text(c.contact, 20, y);
  doc.text(`${t('date')}  ${invoice.created || ''}`, pageW / 2 + 10, y);
  y += 6;
  if (c.email || invoice.clientEmail) doc.text(c.email || invoice.clientEmail, 20, y);
  doc.text(`${t('dueDate')}  ${invoice.due || ''}`, pageW / 2 + 10, y);
  y += 6;
  if (c.country) doc.text(c.country, 20, y);
  doc.text(`${t('status')}  ${(invoice.status ? invoice.status.toUpperCase() : 'SENT')}`, pageW / 2 + 10, y);
  y += 6;
  if (c.phone) {
    doc.text('Phone: ' + c.phone, 20, y);
    y += 6;
  }

  // Table Header Box
  y += 10;
  doc.setFillColor(241, 245, 249);
  doc.rect(20, y - 4, pageW - 40, 9, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(t('description'), 24, y + 2);
  doc.text(t('quantity'), 115, y + 2);
  doc.text(t('rate'), 140, y + 2);
  doc.text(t('amount'), pageW - 24, y + 2, { align: 'right' });

  // Line items
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  const items = Array.isArray(invoice.items) && invoice.items.length > 0
    ? invoice.items
    : [{ description: invoice.description || 'Service', quantity: invoice.quantity || 1, rate: invoice.rate || invoice.amount || 0, amount: (invoice.quantity || 1) * (invoice.rate || invoice.amount || 0) }];

  items.forEach((item) => {
    const itemQty = Number(item.quantity) || 1;
    const itemRate = Number(item.rate) || 0;
    const lineAmt = itemQty * itemRate;

    doc.text(item.description || 'Service', 24, y);
    doc.text(String(itemQty), 117, y);
    doc.text(formatMoney(itemRate), 140, y);
    doc.text(formatMoney(lineAmt), pageW - 24, y, { align: 'right' });
    y += 8;
  });

  // Divider Line
  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, y, pageW - 20, y);

  // Financial Summary Section
  y += 10;
  const rightCol = pageW - 24;
  doc.setFontSize(10);

  doc.text(`${t('subtotal')}`, rightCol - 65, y);
  doc.text(formatMoney(invoice.subtotal || invoice.amount), rightCol, y, { align: 'right' });
  y += 7;

  if (Number(invoice.discount) > 0) {
    doc.text(`${t('discount')} (${invoice.discount}%):`, rightCol - 65, y);
    doc.text('-' + formatMoney(invoice.discountAmount), rightCol, y, { align: 'right' });
    y += 7;
  }

  if (Number(invoice.tax) > 0 || Number(invoice.taxAmount) > 0) {
    doc.text(`${t('tax')} (${invoice.tax || 18}%):`, rightCol - 65, y);
    doc.text(formatMoney(invoice.taxAmount), rightCol, y, { align: 'right' });
    y += 7;
  }

  // Total Line
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(rightCol - 65, y + 1, rightCol, y + 1);
  y += 8;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text(`${t('total')}`, rightCol - 65, y);
  doc.text(formatMoney(invoice.amount), rightCol, y, { align: 'right' });

  // Notes and terms
  if (invoice.notes) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    y += 18;
    doc.text(t('notes'), 20, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    const lines = doc.splitTextToSize(invoice.notes, pageW - 40);
    doc.text(lines, 20, y);
  }

  // Footer Branding
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`${t('generatedBy')} (${lang})`, pageW / 2, pageH - 12, { align: 'center' });

  // Trigger Save PDF
  doc.save(`${invoice.id || 'Invoice'}_${lang}.pdf`);
  return doc;
}
