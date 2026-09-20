import { formatCurrency } from './currency';

/**
 * Triggers real email delivery for an invoice.
 * Primary method: Launches default email app (Gmail / Outlook / Apple Mail) via mailto: with pre-filled recipient, subject, and invoice body.
 */
export function sendInvoiceEmailViaMailto(invoice, userProfile, clientObj) {
  const recipientEmail = invoice.clientEmail || clientObj?.email;
  if (!recipientEmail) {
    throw new Error('Client email address is missing');
  }

  const senderName = userProfile?.businessName || userProfile?.fullName || 'AutoInvoice Business';
  const currencyStr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);

  const subject = `Invoice ${invoice.id || 'INV-001'} from ${senderName} (${formattedAmount})`;

  const bodyLines = [
    `Dear ${invoice.client || clientObj?.company || 'Valued Client'},`,
    ``,
    `Please find your invoice details below from ${senderName}:`,
    ``,
    `----------------------------------------`,
    `Invoice Number : ${invoice.id || 'INV-001'}`,
    `Issue Date     : ${invoice.created || 'Today'}`,
    `Due Date       : ${invoice.due || 'Upon Receipt'}`,
    `Total Amount   : ${formattedAmount}`,
    `Status         : ${(invoice.status || 'SENT').toUpperCase()}`,
    `----------------------------------------`,
    ``,
    `Description:`,
    `${invoice.description || 'Professional Services'}`,
    ``,
    invoice.notes ? `Notes / Payment Instructions:\n${invoice.notes}\n` : ``,
    `The PDF invoice has been downloaded to your device. Please attach the downloaded PDF to this email before sending to your client.`,
    ``,
    `Thank you for your business!`,
    ``,
    `Best regards,`,
    `${senderName}`,
    userProfile?.phone ? `Phone: ${userProfile.phone}` : ``,
    userProfile?.website ? `Website: ${userProfile.website}` : ``
  ].filter(line => line !== null && line !== undefined);

  const bodyText = bodyLines.join('\n');
  const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

  // Create temporary link element to trigger mail client cleanly without popup blockage
  const mailLink = document.createElement('a');
  mailLink.href = mailtoUrl;
  mailLink.target = '_blank';
  mailLink.rel = 'noopener noreferrer';
  document.body.appendChild(mailLink);
  mailLink.click();
  document.body.removeChild(mailLink);

  return { recipientEmail, subject };
}
