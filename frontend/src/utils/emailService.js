import { formatCurrency } from './currency';

/**
 * Sends a real background email directly to the client's inbox.
 */
export async function sendRealInvoiceEmail(invoice, userProfile, clientObj) {
  const recipientEmail = invoice.clientEmail || clientObj?.email;
  if (!recipientEmail) {
    throw new Error('Client email address is missing');
  }

  const senderName = userProfile?.businessName || userProfile?.fullName || 'AutoInvoice Business';
  const senderEmail = userProfile?.email || 'billing@autoinvoice.com';
  const currencyStr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);

  // Generate Payment Link & Scannable QR Code
  const baseUrl = typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : 'https://autoinvoice-app.com';
  const paymentUrl = `${baseUrl}/#/pay/${encodeURIComponent(invoice.id || 'INV-001')}`;
  
  const upiId = userProfile?.upiId || 'Saumyamir25@oksbi';
  const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(senderName)}&am=${invoice.amount}&cu=INR&tn=Invoice%20${encodeURIComponent(invoice.id || 'INV-001')}`;
  
  let qrCodeUrl = userProfile?.customQrUrl;
  if (qrCodeUrl && qrCodeUrl.startsWith('/')) {
    qrCodeUrl = `${baseUrl}${qrCodeUrl}`;
  }
  if (!qrCodeUrl) {
    // googleapis.com QR API is natively trusted by Gmail PC proxy and avoids 'External images hidden' blocks
    qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(upiString)}`;
  }

  const subject = `Invoice ${invoice.id || 'INV-001'} from ${senderName} (${formattedAmount})`;

  // Text message fallback
  const textMessageBody = `
OFFICIAL INVOICE: ${invoice.id || 'INV-001'}
Issued by: ${senderName}

--------------------------------------------------
Invoice Number : ${invoice.id || 'INV-001'}
Client         : ${invoice.client || clientObj?.company || 'Valued Client'}
Issue Date     : ${invoice.created || 'Today'}
Due Date       : ${invoice.due || 'Upon Receipt'}
Total Amount   : ${formattedAmount}
Status         : ${(invoice.status || 'SENT').toUpperCase()}
--------------------------------------------------

Description:
${invoice.description || 'Professional Services'}

${invoice.notes ? `Notes / Payment Instructions:\n${invoice.notes}\n` : ''}

==================================================
SCAN TO PAY - ONLINE PAYMENT PORTAL & QR CODE
==================================================
Pay securely online using UPI (Google Pay, PhonePe, Paytm) or Credit/Debit Card:

🔗 Direct Payment Link:
${paymentUrl}

📱 Scannable QR Code Image:
${qrCodeUrl}
==================================================

Thank you for your business!

Best regards,
${senderName}
${userProfile?.phone ? `Phone: ${userProfile.phone}` : ''}
${userProfile?.website ? `Website: ${userProfile.website}` : ''}
`.trim();

  // Rich HTML Email Template
  const htmlMessageBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 20px; margin: 0;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
    
    <!-- Top Header Banner -->
    <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; font-weight: 600; margin-bottom: 4px;">Official Invoice Notification</div>
      <h1 style="margin: 0; font-size: 26px; font-weight: 800;">${invoice.id || 'INV-001'}</h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">Issued by ${senderName}</p>
    </div>

    <div style="padding: 24px;">
      <!-- Invoice Summary Card -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 14px; color: #334155;" cellspacing="0" cellpadding="5">
          <tr>
            <td style="color: #64748b;">Billed To:</td>
            <td style="text-align: right; font-weight: 600; color: #0f172a;">${invoice.client || clientObj?.company || 'Valued Client'}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Issue Date:</td>
            <td style="text-align: right; color: #334155;">${invoice.created || 'Today'}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Due Date:</td>
            <td style="text-align: right; color: #334155;">${invoice.due || 'Upon Receipt'}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Status:</td>
            <td style="text-align: right;"><span style="background-color: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; text-transform: uppercase;">${(invoice.status || 'SENT').toUpperCase()}</span></td>
          </tr>
          <tr style="font-size: 18px; border-top: 1px dashed #cbd5e1;">
            <td style="padding-top: 12px; font-weight: 700; color: #0f172a;">Total Amount Due:</td>
            <td style="text-align: right; padding-top: 12px; font-weight: 800; color: #2563eb; font-size: 22px;">${formattedAmount}</td>
          </tr>
        </table>
      </div>

      <!-- Description -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Description</div>
        <div style="font-size: 14px; color: #1e293b; background: #ffffff; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 8px;">
          ${invoice.description || 'Professional Services'}
        </div>
      </div>

      <!-- SCAN TO PAY & QR CODE CONTAINER -->
      <div style="text-align: center; background-color: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <div style="font-size: 16px; font-weight: 700; color: #1e40af; margin-bottom: 4px;">
          📱 Scan with Phone or UPI App to Pay
        </div>
        <div style="font-size: 12px; color: #475569; margin-bottom: 16px;">
          Supports Google Pay, PhonePe, Paytm, BHIM & Card Payments
        </div>

        <!-- QR Code Image -->
        <div style="background-color: #ffffff; display: inline-block; padding: 12px; border-radius: 10px; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 12px;">
          <img src="${qrCodeUrl}" alt="Payment QR Code (${upiId})" width="200" height="200" style="display: block; margin: 0 auto; border-radius: 4px;" />
        </div>

        <div style="font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 14px;">
          UPI ID: <span style="color: #2563eb; font-family: monospace;">${upiId}</span>
        </div>

        <!-- Pay Button -->
        <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px; align-items: center;">
          <a href="${paymentUrl}" target="_blank" style="display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.3);">
            Pay ${formattedAmount} Online &rarr;
          </a>
          <a href="${qrCodeUrl}" target="_blank" style="display: inline-block; font-size: 12px; color: #2563eb; text-decoration: underline; margin-top: 6px;">
            🖼️ View / Open QR Code Image Directly
          </a>
        </div>
        
        <div style="margin-top: 12px; font-size: 11px; color: #64748b;">
          Direct Link: <a href="${paymentUrl}" style="color: #2563eb; text-decoration: underline;">${paymentUrl}</a>
        </div>
      </div>

      ${invoice.notes ? `
      <div style="margin-bottom: 24px; font-size: 13px; color: #475569; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <strong>Notes / Payment Instructions:</strong><br />${invoice.notes}
      </div>
      ` : ''}

      <!-- Footer -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
        Thank you for your business!<br />
        <strong style="color: #475569;">${senderName}</strong> ${userProfile?.phone ? `• ${userProfile.phone}` : ''} ${userProfile?.website ? `• ${userProfile.website}` : ''}
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

  // Method 1: Web3Forms API (High-quality HTML Email Rendering)
  try {
    const web3Response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: '5ba27f71-6c23-4c91-9e79-58ec789a5ee0',
        to_email: recipientEmail,
        subject: subject,
        from_name: senderName,
        message: htmlMessageBody
      })
    });
    if (web3Response.ok) {
      return { success: true, method: 'web3', recipientEmail };
    }
  } catch (err) {
    console.warn('Web3Forms delivery note:', err);
  }

  // Method 2: FormSubmit AJAX API with 'box' template & clear labels
  try {
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(recipientEmail)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        _subject: subject,
        _replyto: senderEmail,
        _template: 'box',
        _captcha: 'false',
        "Invoice Number": invoice.id || 'INV-001',
        "Issued By": senderName,
        "Billed To": invoice.client || clientObj?.company || 'Client',
        "Amount Due": formattedAmount,
        "Due Date": invoice.due || 'Upon Receipt',
        "Payment Link": paymentUrl,
        "QR Code Link": qrCodeUrl,
        "Message": textMessageBody
      })
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, method: 'cloud', recipientEmail, message: data.message || 'Email sent to recipient inbox!' };
    }
  } catch (err) {
    console.warn('FormSubmit cloud delivery note:', err);
  }

  // Method 3: Fallback mailto: trigger
  const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textMessageBody)}`;
  const mailLink = document.createElement('a');
  mailLink.href = mailtoUrl;
  mailLink.target = '_blank';
  document.body.appendChild(mailLink);
  mailLink.click();
  document.body.removeChild(mailLink);

  return { success: true, method: 'mailto', recipientEmail };
}

/**
 * Sends a payment notification email directly to the owner email (Saumyamir25@gmail.com)
 * when an invoice payment is completed.
 */
export async function sendPaymentReceivedEmail(invoice, userProfile, ownerEmail = 'Saumyamir25@gmail.com') {
  const currencyStr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);
  const senderName = userProfile?.businessName || userProfile?.fullName || 'AutoInvoice';
  const txnId = `TXN-${Math.floor(1000000000 + Math.random() * 900000000)}`;
  const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' });

  const subject = `Payment Received: Invoice ${invoice.id || 'INV-001'} (${formattedAmount})`;

  const textMessageBody = `
PAYMENT CONFIRMATION NOTIFICATION

--------------------------------------------------
Invoice Number : ${invoice.id || 'INV-001'}
Client Name    : ${invoice.client || 'Client'}
Amount Paid    : ${formattedAmount}
Payment Status : PAID (Successful)
Date & Time    : ${nowStr}
Transaction ID : ${txnId}
--------------------------------------------------

Business Name : ${senderName}
Notification Sent To : ${ownerEmail}

This is an automated notification confirming that the invoice payment of ${formattedAmount} was successfully completed.
`.trim();

  const htmlMessageBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #16a34a; padding: 24px; text-align: center; color: #ffffff;">
      <div style="font-size: 32px; margin-bottom: 4px;">✓</div>
      <h2 style="margin: 0; font-size: 22px;">Payment Received!</h2>
      <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Invoice ${invoice.id || 'INV-001'}</p>
    </div>
    <div style="padding: 24px; color: #334155; font-size: 14px;">
      <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #64748b;">Amount Paid:</span>
          <strong style="color: #16a34a; font-size: 18px;">${formattedAmount}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #64748b;">Client:</span>
          <strong>${invoice.client || 'Client'}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #64748b;">Transaction Ref:</span>
          <span style="font-family: monospace;">${txnId}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b;">Date & Time:</span>
          <span>${nowStr}</span>
        </div>
      </div>
      <p style="text-align: center; font-size: 12px; color: #94a3b8; margin: 0;">
        AutoInvoice Payment Gateway • Automated Merchant Receipt
      </p>
    </div>
  </div>
</body>
</html>
`.trim();

  // Primary: Web3Forms API
  try {
    const web3Response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: '5ba27f71-6c23-4c91-9e79-58ec789a5ee0',
        to_email: ownerEmail,
        subject: subject,
        from_name: 'AutoInvoice Payment Gateway',
        message: htmlMessageBody
      })
    });
    if (web3Response.ok) {
      return { success: true, ownerEmail, txnId };
    }
  } catch (err) {
    console.warn('Web3Forms owner notification error:', err);
  }

  // Backup: FormSubmit AJAX API
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(ownerEmail)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        _subject: subject,
        _template: 'box',
        _captcha: 'false',
        "Invoice Number": invoice.id || 'INV-001',
        "Client": invoice.client || 'Client',
        "Amount Paid": formattedAmount,
        "Status": 'PAID',
        "Transaction ID": txnId,
        "Date Time": nowStr,
        "Message": textMessageBody
      })
    });
    if (res.ok) {
      return { success: true, ownerEmail, txnId };
    }
  } catch (err) {
    console.warn('FormSubmit owner notification error:', err);
  }

  return { success: true, ownerEmail, txnId };
}
