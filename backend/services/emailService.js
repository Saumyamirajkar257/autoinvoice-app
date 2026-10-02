const nodemailer = require('nodemailer');

/**
 * AutoInvoice Backend Email Service
 * Sends transactional emails through configurable SMTP/provider.
 * 
 * Supports: Resend, SendGrid, Gmail SMTP, or any SMTP provider
 * via environment variables.
 */

// Create reusable transporter based on environment config
function createTransporter() {
  const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();

  if (provider === 'resend') {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.EMAIL_API_KEY
      }
    });
  }

  if (provider === 'sendgrid') {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.EMAIL_API_KEY
      }
    });
  }

  if (provider === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_APP_PASSWORD
      }
    });
  }

  // Default: generic SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_FROM,
      pass: process.env.SMTP_PASS || process.env.EMAIL_API_KEY
    }
  });
}

/**
 * Format currency with symbol
 */
function formatCurrency(amount, currencyString) {
  const symbols = {
    'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£', 'CAD': 'CA$', 'AUD': 'A$'
  };
  
  let code = 'INR';
  if (currencyString) {
    for (const c of Object.keys(symbols)) {
      if (currencyString.includes(c)) { code = c; break; }
    }
  }
  
  const num = Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${symbols[code] || '₹'}${num}`;
}

/**
 * Build the invoice email HTML template
 */
function buildInvoiceEmailHTML(invoice, senderProfile, paymentUrl) {
  const senderName = senderProfile?.businessName || senderProfile?.fullName || 'AutoInvoice Business';
  const currencyStr = invoice.currency || senderProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);
  
  // UPI QR Code URL
  const upiId = senderProfile?.upiId || '';
  let qrCodeUrl = senderProfile?.customQrUrl || '';
  if (!qrCodeUrl && upiId) {
    const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(senderName)}&am=${invoice.amount}&cu=INR&tn=Invoice%20${encodeURIComponent(invoice.id || 'INV-001')}`;
    qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chs=240x240&chl=${encodeURIComponent(upiString)}`;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.id} from ${senderName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 20px; margin: 0;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
    
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; font-weight: 600; margin-bottom: 4px;">Invoice</div>
      <h1 style="margin: 0; font-size: 26px; font-weight: 800;">${invoice.id || 'INV-001'}</h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">From ${senderName}</p>
    </div>

    <div style="padding: 24px;">
      <!-- Invoice Summary -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 14px; color: #334155;" cellspacing="0" cellpadding="5">
          <tr>
            <td style="color: #64748b;">Billed To:</td>
            <td style="text-align: right; font-weight: 600; color: #0f172a;">${invoice.client || 'Client'}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Issue Date:</td>
            <td style="text-align: right; color: #334155;">${invoice.created || 'Today'}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Due Date:</td>
            <td style="text-align: right; color: #334155;">${invoice.due || 'Upon Receipt'}</td>
          </tr>
          <tr style="font-size: 18px; border-top: 1px dashed #cbd5e1;">
            <td style="padding-top: 12px; font-weight: 700; color: #0f172a;">Amount Due:</td>
            <td style="text-align: right; padding-top: 12px; font-weight: 800; color: #2563eb; font-size: 22px;">${formattedAmount}</td>
          </tr>
        </table>
      </div>

      ${invoice.description ? `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 13px; text-transform: uppercase; color: #64748b; margin-bottom: 6px;">Description</h3>
        <p style="color: #334155; font-size: 14px; margin: 0;">${invoice.description}</p>
      </div>
      ` : ''}

      ${invoice.notes ? `
      <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
        <strong style="font-size: 12px; color: #92400e;">Payment Terms:</strong>
        <p style="color: #78350f; font-size: 13px; margin: 4px 0 0 0;">${invoice.notes}</p>
      </div>
      ` : ''}

      <!-- Action Buttons -->
      <div style="text-align: center; margin-bottom: 24px;">
        ${paymentUrl ? `
        <a href="${paymentUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; padding: 14px 40px; border-radius: 8px; font-size: 15px; font-weight: 700; text-decoration: none; letter-spacing: 0.5px;">
          View Invoice & Pay
        </a>
        <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0 0;">Click to view invoice details and make payment</p>
        ` : ''}
      </div>

      ${qrCodeUrl ? `
      <div style="text-align: center; margin-bottom: 24px;">
        <p style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Scan to Pay via UPI</p>
        <img src="${qrCodeUrl}" alt="Payment QR Code" width="200" height="200" style="border-radius: 8px; border: 1px solid #e2e8f0;" />
      </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        Sent via <strong>AutoInvoice</strong> • Professional Invoice Management
      </p>
      ${senderProfile?.phone ? `<p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0 0;">Contact: ${senderProfile.phone}</p>` : ''}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Build the payment receipt email HTML
 */
function buildReceiptEmailHTML(invoice, senderProfile, payment) {
  const senderName = senderProfile?.businessName || senderProfile?.fullName || 'AutoInvoice Business';
  const currencyStr = invoice.currency || senderProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Receipt - ${invoice.id}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 20px; margin: 0;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
    
    <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; font-weight: 600; margin-bottom: 4px;">Payment Receipt</div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 800;">✓ Payment Confirmed</h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">Invoice ${invoice.id}</p>
    </div>

    <div style="padding: 24px;">
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
        <table style="width: 100%; font-size: 14px; color: #334155;" cellspacing="0" cellpadding="5">
          <tr>
            <td style="color: #64748b;">From:</td>
            <td style="text-align: right; font-weight: 600;">${senderName}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Billed To:</td>
            <td style="text-align: right; font-weight: 600;">${invoice.client || 'Client'}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Amount Paid:</td>
            <td style="text-align: right; font-weight: 800; color: #16a34a; font-size: 18px;">${formattedAmount}</td>
          </tr>
          ${payment?.transactionId ? `
          <tr>
            <td style="color: #64748b;">Transaction ID:</td>
            <td style="text-align: right; font-weight: 600;">${payment.transactionId}</td>
          </tr>
          ` : ''}
          ${payment?.method ? `
          <tr>
            <td style="color: #64748b;">Payment Method:</td>
            <td style="text-align: right; text-transform: uppercase;">${payment.method}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="color: #64748b;">Payment Date:</td>
            <td style="text-align: right;">${payment?.paidAt ? new Date(payment.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
          </tr>
        </table>
      </div>
      
      <p style="font-size: 13px; color: #64748b; text-align: center;">Thank you for your payment!</p>
    </div>

    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        Sent via <strong>AutoInvoice</strong> • Professional Invoice Management
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Build reminder email HTML
 */
function buildReminderEmailHTML(invoice, senderProfile, reminderType, paymentUrl) {
  const senderName = senderProfile?.businessName || senderProfile?.fullName || 'AutoInvoice Business';
  const currencyStr = invoice.currency || senderProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);

  const headings = {
    upcoming: 'Payment Reminder',
    due_today: 'Payment Due Today',
    overdue: 'Payment Overdue'
  };
  const colors = {
    upcoming: { bg: '#2563eb', gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' },
    due_today: { bg: '#d97706', gradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' },
    overdue: { bg: '#dc2626', gradient: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' }
  };
  const style = colors[reminderType] || colors.upcoming;
  const heading = headings[reminderType] || 'Payment Reminder';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${heading} - Invoice ${invoice.id}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 20px; margin: 0;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
    
    <div style="background: ${style.gradient}; padding: 28px 24px; text-align: center; color: #ffffff;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; font-weight: 600; margin-bottom: 4px;">${heading}</div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Invoice ${invoice.id}</h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">From ${senderName}</p>
    </div>

    <div style="padding: 24px;">
      <p style="font-size: 14px; color: #334155; margin-bottom: 16px;">
        ${reminderType === 'overdue' 
          ? `This is a reminder that payment for invoice <strong>${invoice.id}</strong> is now overdue. The due date was <strong>${invoice.due || 'N/A'}</strong>.`
          : reminderType === 'due_today'
            ? `This is a friendly reminder that payment for invoice <strong>${invoice.id}</strong> is due today.`
            : `This is a friendly reminder about an upcoming payment for invoice <strong>${invoice.id}</strong>, due on <strong>${invoice.due || 'N/A'}</strong>.`
        }
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 14px; color: #334155;" cellspacing="0" cellpadding="5">
          <tr>
            <td style="color: #64748b;">Client:</td>
            <td style="text-align: right; font-weight: 600;">${invoice.client || 'Client'}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Due Date:</td>
            <td style="text-align: right;">${invoice.due || 'Upon Receipt'}</td>
          </tr>
          <tr style="font-size: 18px; border-top: 1px dashed #cbd5e1;">
            <td style="padding-top: 12px; font-weight: 700;">Amount Due:</td>
            <td style="text-align: right; padding-top: 12px; font-weight: 800; color: ${style.bg}; font-size: 22px;">${formattedAmount}</td>
          </tr>
        </table>
      </div>

      ${paymentUrl ? `
      <div style="text-align: center; margin-bottom: 20px;">
        <a href="${paymentUrl}" style="display: inline-block; background: ${style.gradient}; color: #ffffff; padding: 14px 40px; border-radius: 8px; font-size: 15px; font-weight: 700; text-decoration: none;">
          Pay Now
        </a>
      </div>
      ` : ''}
    </div>

    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        Sent via <strong>AutoInvoice</strong> • Professional Invoice Management
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Build plain text version of invoice email
 */
function buildInvoiceEmailText(invoice, senderProfile, paymentUrl) {
  const senderName = senderProfile?.businessName || senderProfile?.fullName || 'AutoInvoice Business';
  const currencyStr = invoice.currency || senderProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);

  return `
INVOICE: ${invoice.id || 'INV-001'}
From: ${senderName}

----------------------------------------------
Billed To  : ${invoice.client || 'Client'}
Issue Date : ${invoice.created || 'Today'}
Due Date   : ${invoice.due || 'Upon Receipt'}
Amount Due : ${formattedAmount}
----------------------------------------------

${invoice.description ? `Description: ${invoice.description}\n` : ''}
${invoice.notes ? `Payment Terms: ${invoice.notes}\n` : ''}

${paymentUrl ? `View Invoice & Pay: ${paymentUrl}\n` : ''}

Thank you for your business!
${senderName}
${senderProfile?.phone ? `Phone: ${senderProfile.phone}` : ''}
${senderProfile?.website ? `Website: ${senderProfile.website}` : ''}

---
Sent via AutoInvoice
`.trim();
}

/**
 * Send an invoice email to the client
 */
async function sendInvoiceEmail(invoice, senderProfile, recipientEmail, paymentUrl) {
  if (!recipientEmail) {
    throw new Error('Recipient email address is required');
  }

  const senderName = senderProfile?.businessName || senderProfile?.fullName || 'AutoInvoice';
  const fromEmail = process.env.EMAIL_FROM || senderProfile?.email || 'noreply@autoinvoice.app';
  const currencyStr = invoice.currency || senderProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);
  
  const subject = `Invoice ${invoice.id || 'INV-001'} from ${senderName} (${formattedAmount})`;

  const transporter = createTransporter();

  const mailOptions = {
    from: `"${senderName}" <${fromEmail}>`,
    to: recipientEmail,
    subject: subject,
    text: buildInvoiceEmailText(invoice, senderProfile, paymentUrl),
    html: buildInvoiceEmailHTML(invoice, senderProfile, paymentUrl)
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      recipientEmail,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Email send error:', error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Send a payment receipt email
 */
async function sendReceiptEmail(invoice, senderProfile, recipientEmail, payment) {
  if (!recipientEmail) {
    throw new Error('Recipient email address is required');
  }

  const senderName = senderProfile?.businessName || senderProfile?.fullName || 'AutoInvoice';
  const fromEmail = process.env.EMAIL_FROM || senderProfile?.email || 'noreply@autoinvoice.app';
  const currencyStr = invoice.currency || senderProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);
  
  const subject = `Payment Receipt - Invoice ${invoice.id} (${formattedAmount})`;

  const transporter = createTransporter();

  const mailOptions = {
    from: `"${senderName}" <${fromEmail}>`,
    to: recipientEmail,
    subject: subject,
    html: buildReceiptEmailHTML(invoice, senderProfile, payment)
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      recipientEmail,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Receipt email error:', error.message);
    throw new Error(`Failed to send receipt: ${error.message}`);
  }
}

/**
 * Send a payment reminder email
 */
async function sendReminderEmail(invoice, senderProfile, recipientEmail, reminderType, paymentUrl) {
  if (!recipientEmail) {
    throw new Error('Recipient email address is required');
  }

  const senderName = senderProfile?.businessName || senderProfile?.fullName || 'AutoInvoice';
  const fromEmail = process.env.EMAIL_FROM || senderProfile?.email || 'noreply@autoinvoice.app';
  
  const typeLabels = {
    upcoming: 'Payment Reminder',
    due_today: 'Payment Due Today',
    overdue: 'OVERDUE Payment Reminder'
  };
  
  const subject = `${typeLabels[reminderType] || 'Payment Reminder'} - Invoice ${invoice.id}`;

  const transporter = createTransporter();

  const mailOptions = {
    from: `"${senderName}" <${fromEmail}>`,
    to: recipientEmail,
    subject: subject,
    html: buildReminderEmailHTML(invoice, senderProfile, reminderType, paymentUrl)
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      recipientEmail,
      reminderType,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Reminder email error:', error.message);
    throw new Error(`Failed to send reminder: ${error.message}`);
  }
}

module.exports = {
  sendInvoiceEmail,
  sendReceiptEmail,
  sendReminderEmail,
  buildInvoiceEmailHTML,
  buildReceiptEmailHTML,
  buildReminderEmailHTML,
  formatCurrency
};
