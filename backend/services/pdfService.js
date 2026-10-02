const { jsPDF } = require('jspdf');

/**
 * Backend Invoice PDF Generator
 * Generates an official, publication-quality A4 PDF for invoice email attachments.
 */
function generateInvoicePDFBuffer(invoice, senderProfile, clientObj) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 20;

  const senderName = senderProfile?.businessName || senderProfile?.fullName || 'AutoInvoice Business';
  const clientName = invoice.client || clientObj?.company || 'Valued Client';
  const clientEmail = invoice.clientEmail || clientObj?.email || '';

  // Header Banner
  doc.setFillColor(37, 99, 235); // #2563eb
  doc.rect(0, 0, pageW, 35, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(senderName.toUpperCase(), margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(220, 235, 252);
  doc.text('OFFICIAL TAX INVOICE', margin, 26);

  // Invoice Number Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(invoice.id || 'INV-001', pageW - margin, 20, { align: 'right' });

  // Meta Info Section
  let y = 48;
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('BILLED TO:', margin, y);
  doc.text('INVOICE DETAILS:', pageW / 2 + 10, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.text(clientName, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Issue Date: ${invoice.created || 'Today'}`, pageW / 2 + 10, y);

  y += 5;
  if (clientEmail) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(clientEmail, margin, y);
  }
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Due Date: ${invoice.due || 'Upon Receipt'}`, pageW / 2 + 10, y);

  y += 5;
  doc.text(`Status: ${(invoice.status || 'SENT').toUpperCase()}`, pageW / 2 + 10, y);

  // Items Table Header
  y += 16;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageW - margin * 2, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('DESCRIPTION', margin + 4, y + 5.5);
  doc.text('QTY', pageW - margin - 70, y + 5.5, { align: 'right' });
  doc.text('RATE', pageW - margin - 35, y + 5.5, { align: 'right' });
  doc.text('AMOUNT', pageW - margin - 4, y + 5.5, { align: 'right' });

  // Items Rows
  const items = Array.isArray(invoice.items) && invoice.items.length > 0 ? invoice.items : [
    {
      description: invoice.description || 'Professional Services',
      quantity: Number(invoice.quantity) || 1,
      rate: Number(invoice.rate) || Number(invoice.amount) || 0,
      amount: Number(invoice.amount) || 0
    }
  ];

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);

  items.forEach(it => {
    const qty = Number(it.quantity) || 1;
    const rate = Number(it.rate) || 0;
    const amount = Number(it.amount) || qty * rate;

    doc.text(String(it.description || 'Item').substring(0, 50), margin + 4, y);
    doc.text(String(qty), pageW - margin - 70, y, { align: 'right' });
    doc.text(`₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageW - margin - 35, y, { align: 'right' });
    doc.text(`₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageW - margin - 4, y, { align: 'right' });

    y += 7;
  });

  // Divider
  y += 2;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);

  // Totals Section
  y += 8;
  const subtotal = Number(invoice.subtotal || invoice.amount || 0);
  const tax = Number(invoice.taxAmount || 0);
  const total = Number(invoice.amount || subtotal + tax);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal:', pageW - margin - 65, y);
  doc.setTextColor(30, 41, 59);
  doc.text(`₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageW - margin - 4, y, { align: 'right' });

  if (tax > 0) {
    y += 6;
    doc.setTextColor(100, 116, 139);
    doc.text(`Tax / GST (${invoice.tax || 18}%):`, pageW - margin - 65, y);
    doc.setTextColor(30, 41, 59);
    doc.text(`₹${tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageW - margin - 4, y, { align: 'right' });
  }

  y += 8;
  doc.setFillColor(239, 246, 255);
  doc.rect(pageW - margin - 75, y - 5, 75, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(37, 99, 235);
  doc.text('Total Due:', pageW - margin - 70, y + 2.5);
  doc.text(`₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageW - margin - 4, y + 2.5, { align: 'right' });

  // Notes
  if (invoice.notes) {
    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('NOTES & PAYMENT TERMS:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const splitNotes = doc.splitTextToSize(invoice.notes, pageW - margin * 2);
    doc.text(splitNotes, margin, y);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated by AutoInvoice • Issued by ${senderName}`, pageW / 2, 285, { align: 'center' });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

module.exports = {
  generateInvoicePDFBuffer
};
