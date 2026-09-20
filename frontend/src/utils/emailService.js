import { formatCurrency } from './currency';

/**
 * Sends a real background email directly to the client's inbox (Gmail, Outlook, Yahoo, etc.).
 * Uses a cloud email dispatch service so emails arrive directly in the recipient's inbox.
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

  const subject = `Invoice ${invoice.id || 'INV-001'} from ${senderName} (${formattedAmount})`;

  const messageBody = `
Dear ${invoice.client || clientObj?.company || 'Valued Client'},

Please find your official invoice details below from ${senderName}:

--------------------------------------------------
Invoice Number : ${invoice.id || 'INV-001'}
Issue Date     : ${invoice.created || 'Today'}
Due Date       : ${invoice.due || 'Upon Receipt'}
Total Amount   : ${formattedAmount}
Status         : ${(invoice.status || 'SENT').toUpperCase()}
--------------------------------------------------

Description:
${invoice.description || 'Professional Services'}

${invoice.notes ? `Notes / Payment Instructions:\n${invoice.notes}\n` : ''}

Thank you for your business!

Best regards,
${senderName}
${userProfile?.phone ? `Phone: ${userProfile.phone}` : ''}
${userProfile?.website ? `Website: ${userProfile.website}` : ''}
`.trim();

  // Method 1: FormSubmit Background Email API (Delivers real email to recipient email inbox)
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
        _template: 'table',
        _captcha: 'false',
        name: senderName,
        email: senderEmail,
        invoice_number: invoice.id || 'INV-001',
        client: invoice.client || clientObj?.company || 'Client',
        amount: formattedAmount,
        due_date: invoice.due || 'Not set',
        status: (invoice.status || 'SENT').toUpperCase(),
        message: messageBody
      })
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, method: 'cloud', recipientEmail, message: data.message || 'Email sent to recipient inbox!' };
    }
  } catch (err) {
    console.warn('FormSubmit cloud delivery note:', err);
  }

  // Method 2: Web3Forms API
  try {
    const web3Response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: '5ba27f71-6c23-4c91-9e79-58ec789a5ee0',
        to_email: recipientEmail,
        subject: subject,
        from_name: senderName,
        message: messageBody
      })
    });
    if (web3Response.ok) {
      return { success: true, method: 'web3', recipientEmail };
    }
  } catch (err) {
    console.warn('Web3Forms fallback note:', err);
  }

  // Method 3: Fallback mailto: trigger
  const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageBody)}`;
  const mailLink = document.createElement('a');
  mailLink.href = mailtoUrl;
  mailLink.target = '_blank';
  document.body.appendChild(mailLink);
  mailLink.click();
  document.body.removeChild(mailLink);

  return { success: true, method: 'mailto', recipientEmail };
}
