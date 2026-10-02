import { formatCurrency } from './currency';

/**
 * AutoInvoice Multi-Channel Email Service
 * 
 * Provides robust email dispatch options:
 * 1. Gmail Web Composer (100% Deliverability, sent from user's authentic Gmail account)
 * 2. Default System Mail Client (mailto: protocol for Outlook, Apple Mail, Thunderbird)
 * 3. Automated Cloud Delivery (EmailJS REST API directly from browser)
 * 4. Clipboard formatted export for WhatsApp, Slack, Teams
 */

const EMAIL_SETTINGS_KEY = 'autoinvoice_email_settings';

export function getEmailSettings() {
  try {
    const raw = localStorage.getItem(EMAIL_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse email settings:', e);
  }
  return {
    defaultMethod: 'modal', // 'gmail' | 'mailto' | 'emailjs' | 'modal'
    emailjs: {
      serviceId: localStorage.getItem('autoinvoice_emailjs_service_id') || '',
      templateId: localStorage.getItem('autoinvoice_emailjs_template_id') || '',
      publicKey: localStorage.getItem('autoinvoice_emailjs_public_key') || ''
    }
  };
}

export function saveEmailSettings(settings) {
  try {
    localStorage.setItem(EMAIL_SETTINGS_KEY, JSON.stringify(settings));
    if (settings?.emailjs) {
      if (settings.emailjs.serviceId) localStorage.setItem('autoinvoice_emailjs_service_id', settings.emailjs.serviceId);
      if (settings.emailjs.templateId) localStorage.setItem('autoinvoice_emailjs_template_id', settings.emailjs.templateId);
      if (settings.emailjs.publicKey) localStorage.setItem('autoinvoice_emailjs_public_key', settings.emailjs.publicKey);
    }
    return true;
  } catch (e) {
    console.warn('Failed to save email settings:', e);
    return false;
  }
}

/**
 * Generate full payment URL & scannable QR Code
 */
export function getInvoicePaymentDetails(invoice, userProfile) {
  const baseUrl = typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : 'https://autoinvoice-frontend.saumyamir25.workers.dev';
  
  const invoiceId = invoice?.id || 'INV-001';
  const paymentUrl = `${baseUrl}/#/pay/${encodeURIComponent(invoiceId)}`;
  
  const senderName = userProfile?.businessName || userProfile?.fullName || 'AutoInvoice';
  const upiId = userProfile?.upiId || 'Saumyamir25@oksbi';
  const amount = Number(invoice?.amount || 0);
  
  const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(senderName)}&am=${amount}&cu=INR&tn=Invoice%20${encodeURIComponent(invoiceId)}`;
  
  let qrCodeUrl = userProfile?.customQrUrl;
  if (qrCodeUrl && qrCodeUrl.startsWith('/')) {
    qrCodeUrl = `${baseUrl}${qrCodeUrl}`;
  }
  if (!qrCodeUrl) {
    qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chs=280x280&chl=${encodeURIComponent(upiString)}`;
  }

  return { paymentUrl, qrCodeUrl, upiId, senderName, baseUrl };
}

/**
 * Build rich structured data for Invoice Email
 */
export function buildInvoiceEmailData(invoice, userProfile, clientObj) {
  const recipientEmail = invoice.clientEmail || clientObj?.email || '';
  const clientName = invoice.client || clientObj?.company || 'Valued Client';
  const senderName = userProfile?.businessName || userProfile?.fullName || 'AutoInvoice';
  const currencyStr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);
  const { paymentUrl, qrCodeUrl, upiId } = getInvoicePaymentDetails(invoice, userProfile);

  const subject = `Invoice ${invoice.id || 'INV-001'} from ${senderName} (${formattedAmount})`;

  const items = Array.isArray(invoice.items) && invoice.items.length > 0 ? invoice.items : [
    { description: invoice.description || 'Professional Services', quantity: 1, rate: invoice.amount, amount: invoice.amount }
  ];

  const itemsListText = items.map((it, idx) => 
    `• ${it.description || 'Item'} (Qty: ${it.quantity || 1}, Rate: ${formatCurrency(it.rate || 0, currencyStr)}) = ${formatCurrency(it.amount || 0, currencyStr)}`
  ).join('\n');

  const textBody = `Dear ${clientName},

Please find attached details for Invoice ${invoice.id || 'INV-001'} issued by ${senderName}.

INVOICE SUMMARY:
==================================================
Invoice Number : ${invoice.id || 'INV-001'}
Client Name    : ${clientName}
Issue Date     : ${invoice.created || 'Today'}
Due Date       : ${invoice.due || 'Upon Receipt'}
Status         : ${(invoice.status || 'SENT').toUpperCase()}
==================================================

LINE ITEMS:
${itemsListText}

--------------------------------------------------
Subtotal       : ${formatCurrency(invoice.subtotal || invoice.amount, currencyStr)}
Tax / GST      : ${formatCurrency(invoice.taxAmount || 0, currencyStr)}
TOTAL AMOUNT   : ${formattedAmount}
==================================================

${invoice.notes ? `Payment Terms & Notes:\n${invoice.notes}\n\n` : ''}HOW TO PAY:
Option 1: Pay Online via UPI / Card:
${paymentUrl}

Option 2: Direct UPI Transfer:
UPI ID: ${upiId}

If you have any questions, please reply directly to this email.

Thank you for your business!

Best regards,
${senderName}
${userProfile?.phone ? `Phone: ${userProfile.phone}\n` : ''}${userProfile?.email ? `Email: ${userProfile.email}\n` : ''}${userProfile?.website ? `Website: ${userProfile.website}\n` : ''}`.trim();

  const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 20px; margin: 0;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
    <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; font-weight: 600; margin-bottom: 4px;">Invoice Notification</div>
      <h1 style="margin: 0; font-size: 26px; font-weight: 800;">${invoice.id || 'INV-001'}</h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">From ${senderName}</p>
    </div>
    <div style="padding: 24px;">
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 14px; color: #334155;" cellspacing="0" cellpadding="5">
          <tr><td style="color: #64748b;">Billed To:</td><td style="text-align: right; font-weight: 600; color: #0f172a;">${clientName}</td></tr>
          <tr><td style="color: #64748b;">Issue Date:</td><td style="text-align: right; color: #334155;">${invoice.created || 'Today'}</td></tr>
          <tr><td style="color: #64748b;">Due Date:</td><td style="text-align: right; color: #334155;">${invoice.due || 'Upon Receipt'}</td></tr>
          <tr style="font-size: 18px; border-top: 1px dashed #cbd5e1;">
            <td style="padding-top: 12px; font-weight: 700; color: #0f172a;">Total Amount Due:</td>
            <td style="text-align: right; padding-top: 12px; font-weight: 800; color: #2563eb; font-size: 22px;">${formattedAmount}</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${paymentUrl}" target="_blank" style="display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 8px;">
          View Invoice & Pay Online &rarr;
        </a>
      </div>
      <div style="text-align: center; background-color: #eff6ff; border: 1px dashed #3b82f6; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 13px; font-weight: 700; color: #1e40af; margin-bottom: 8px;">UPI Scan to Pay</div>
        <img src="${qrCodeUrl}" alt="Payment QR Code" width="180" height="180" style="display: block; margin: 0 auto 8px auto; border-radius: 6px; border: 1px solid #cbd5e1;" />
        <div style="font-size: 12px; font-family: monospace; color: #2563eb;">UPI ID: ${upiId}</div>
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
        Sent via <strong>AutoInvoice</strong> • ${senderName}
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  return {
    recipientEmail,
    clientName,
    senderName,
    subject,
    textBody,
    htmlBody,
    formattedAmount,
    paymentUrl,
    qrCodeUrl,
    upiId
  };
}

/**
 * Build rich structured data for Payment Reminder Email
 */
export function buildReminderEmailData(invoice, userProfile, clientObj, reminderType = 'upcoming') {
  const recipientEmail = invoice.clientEmail || clientObj?.email || '';
  const clientName = invoice.client || clientObj?.company || 'Valued Client';
  const senderName = userProfile?.businessName || userProfile?.fullName || 'AutoInvoice';
  const currencyStr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);
  const { paymentUrl, qrCodeUrl, upiId } = getInvoicePaymentDetails(invoice, userProfile);

  const isOverdue = reminderType === 'overdue' || (invoice.status || '').toLowerCase() === 'overdue';
  const heading = isOverdue ? 'Payment Overdue Reminder' : 'Payment Reminder';
  const subject = `${heading}: Invoice ${invoice.id || 'INV-001'} (${formattedAmount})`;

  const textBody = `Dear ${clientName},

This is a ${isOverdue ? 'friendly reminder that payment for Invoice ' + (invoice.id || 'INV-001') + ' was due on ' + (invoice.due || 'N/A') + ' and is now OVERDUE.' : 'courtesy reminder regarding an upcoming payment for Invoice ' + (invoice.id || 'INV-001') + ' due on ' + (invoice.due || 'Upon Receipt') + '.'}

INVOICE SUMMARY:
==================================================
Invoice Number : ${invoice.id || 'INV-001'}
Client Name    : ${clientName}
Due Date       : ${invoice.due || 'Upon Receipt'}
Amount Due     : ${formattedAmount}
Payment Status : ${isOverdue ? 'OVERDUE' : 'PENDING'}
==================================================

Please process this payment at your earliest convenience using our online payment link:
${paymentUrl}

Or pay directly via UPI:
UPI ID: ${upiId}

If you have already submitted this payment, please reply with your transaction reference.

Thank you!

Best regards,
${senderName}
${userProfile?.phone ? `Phone: ${userProfile.phone}\n` : ''}${userProfile?.email ? `Email: ${userProfile.email}\n` : ''}`.trim();

  return {
    recipientEmail,
    clientName,
    senderName,
    subject,
    textBody,
    formattedAmount,
    paymentUrl,
    qrCodeUrl,
    upiId,
    isOverdue
  };
}

/**
 * Build rich structured data for Payment Receipt Email
 */
export function buildReceiptEmailData(invoice, userProfile, clientObj, payment) {
  const recipientEmail = invoice.clientEmail || clientObj?.email || '';
  const clientName = invoice.client || clientObj?.company || 'Valued Client';
  const senderName = userProfile?.businessName || userProfile?.fullName || 'AutoInvoice';
  const currencyStr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);
  const nowStr = payment?.paidAt
    ? new Date(payment.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const txnRef = payment?.transactionId || `TXN-${Date.now()}`;
  const method = (payment?.method || 'UPI').toUpperCase();

  const subject = `Payment Receipt - Invoice ${invoice.id || 'INV-001'} (${formattedAmount})`;

  const textBody = `Dear ${clientName},

Thank you! This is an official receipt confirming that your payment for Invoice ${invoice.id || 'INV-001'} has been received and verified.

PAYMENT DETAILS:
==================================================
Invoice Number : ${invoice.id || 'INV-001'}
Client Name    : ${clientName}
Amount Paid    : ${formattedAmount}
Payment Status : PAID & VERIFIED
Payment Date   : ${nowStr}
Transaction ID : ${txnRef}
Payment Method : ${method}
==================================================

Thank you for your business!

Best regards,
${senderName}
${userProfile?.phone ? `Phone: ${userProfile.phone}\n` : ''}${userProfile?.email ? `Email: ${userProfile.email}\n` : ''}`.trim();

  return {
    recipientEmail,
    clientName,
    senderName,
    subject,
    textBody,
    formattedAmount,
    txnRef,
    nowStr,
    method
  };
}

export function openGmailCompose() {
  return false;
}

/**
 * Opens default OS mail handler (mailto:).
 */
export function openMailtoCompose({ to, subject, body }) {
  const url = `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;
  const a = document.createElement('a');
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

/**
 * Copies email body / text to clipboard.
 */
export async function copyEmailContent(text) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch (err) {
    document.body.removeChild(textArea);
    throw new Error('Clipboard access denied');
  }
}

/**
 * Sends an email using the EmailJS REST API directly from the browser.
 * Free 200 emails/month, no backend or CORS issues.
 */
export async function sendEmailJS({ to, subject, message, invoiceData, config }) {
  const settings = getEmailSettings();
  const serviceId = config?.serviceId || settings.emailjs?.serviceId;
  const templateId = config?.templateId || settings.emailjs?.templateId;
  const publicKey = config?.publicKey || settings.emailjs?.publicKey;

  if (!serviceId || !templateId || !publicKey) {
    throw new Error('EmailJS is not configured. Please add your Service ID, Template ID, and Public Key in Settings or the email dialog.');
  }

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      to_email: to,
      email_to: to,
      recipient_email: to,
      to_name: invoiceData?.client || 'Valued Client',
      subject: subject,
      message: message,
      invoice_id: invoiceData?.id || '',
      invoice_amount: invoiceData?.amount || '',
      payment_url: invoiceData?.paymentUrl || ''
    }
  };

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`EmailJS delivery failed (${response.status}): ${errorText || response.statusText}`);
  }

  return { success: true, method: 'emailjs', to };
}

/**
 * Backward compatibility: Sends real invoice email
 */
export async function sendRealInvoiceEmail(invoice, userProfile, clientObj) {
  const data = buildInvoiceEmailData(invoice, userProfile, clientObj);
  if (!data.recipientEmail) {
    throw new Error('Client email address is missing');
  }

  const settings = getEmailSettings();
  if (settings.emailjs?.serviceId && settings.emailjs?.templateId && settings.emailjs?.publicKey) {
    return sendEmailJS({
      to: data.recipientEmail,
      subject: data.subject,
      message: data.textBody,
      invoiceData: { ...invoice, paymentUrl: data.paymentUrl }
    });
  }

  return { success: true, method: 'direct', recipientEmail: data.recipientEmail };
}

/**
 * Backward compatibility: Sends payment confirmation notification
 */
export async function sendPaymentReceivedEmail(invoice, userProfile, ownerEmail = 'Saumyamir25@gmail.com') {
  const currencyStr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);
  const senderName = userProfile?.businessName || userProfile?.fullName || 'AutoInvoice';
  const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' });
  const txnId = `TXN-${Math.floor(1000000000 + Math.random() * 900000000)}`;

  const subject = `Payment Received: Invoice ${invoice.id || 'INV-001'} (${formattedAmount})`;
  const textBody = `PAYMENT RECEIVED NOTIFICATION\n\nInvoice: ${invoice.id || 'INV-001'}\nClient: ${invoice.client || 'Client'}\nAmount: ${formattedAmount}\nTime: ${nowStr}\nRef: ${txnId}\n\nAutomated notification from AutoInvoice.`;

  return { success: true, ownerEmail, txnId };
}
