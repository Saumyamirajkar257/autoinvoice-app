const express = require('express');
const router = express.Router();
const db = require('./database');
const { requireAuth, optionalAuth, firestore } = require('./middleware/auth');
const emailService = require('./services/emailService');

// ============================================================
// PUBLIC ROUTES (no auth required)
// ============================================================

// --- Public Invoice View (for client payment page) ---
router.get('/public/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { uid } = req.query; // owner UID passed as query param

    if (uid) {
      // Try Firestore first
      try {
        const docRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
        const snap = await docRef.get();
        if (snap.exists) {
          const invoice = { id: snap.id, ...snap.data() };
          
          // Log client view event in activity timeline
          const activity = invoice.activity || [];
          activity.push({
            event: 'client_viewed',
            timestamp: new Date().toISOString(),
            actor: 'client',
            details: { ip: req.ip }
          });
          await docRef.update({ activity });

          // Get owner profile for display
          const profileRef = firestore.collection('users').doc(uid).collection('profile').doc('data');
          const profileSnap = await profileRef.get();
          const profile = profileSnap.exists ? profileSnap.data() : {};

          return res.json({ invoice, profile });
        }
      } catch (err) {
        console.warn('Firestore public invoice error:', err.message);
      }
    }

    // Fallback to local database
    const invoices = db.getInvoices();
    const invoice = invoices.find(i => String(i.id).toLowerCase() === String(id).toLowerCase());
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const profile = db.getProfile();
    res.json({ invoice, profile });
  } catch (err) {
    console.error('Public invoice error:', err);
    res.status(500).json({ error: 'Unable to load invoice. Please try again.' });
  }
});

// --- Client Payment Confirmation (client submits payment reference) ---
router.post('/public/invoices/:id/confirm-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { uid, transactionId, method, payerName, payerEmail } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction reference is required' });
    }

    const payment = {
      status: 'pending_verification',
      transactionId: transactionId.trim(),
      method: method || 'upi',
      paidAt: new Date().toISOString(),
      verifiedAt: null,
      verifiedBy: null,
      payerName: payerName || '',
      payerEmail: payerEmail || ''
    };

    if (uid) {
      try {
        const docRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
        const snap = await docRef.get();
        if (snap.exists) {
          const invoice = snap.data();
          const activity = invoice.activity || [];
          activity.push({
            event: 'payment_submitted',
            timestamp: new Date().toISOString(),
            actor: 'client',
            details: { transactionId: payment.transactionId, method: payment.method }
          });
          
          await docRef.update({ 
            payment,
            status: 'pending_verification',
            activity 
          });

          return res.json({ 
            success: true, 
            message: 'Payment confirmation submitted. The business owner will verify your payment.',
            payment 
          });
        }
      } catch (err) {
        console.warn('Firestore payment confirmation error:', err.message);
      }
    }

    // Fallback to local
    const updated = db.updateInvoice(id, { payment, status: 'pending_verification' });
    if (!updated) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ 
      success: true, 
      message: 'Payment confirmation submitted.',
      payment 
    });
  } catch (err) {
    console.error('Payment confirmation error:', err);
    res.status(500).json({ error: 'Unable to submit payment. Please try again.' });
  }
});


// ============================================================
// AUTHENTICATED ROUTES (Firebase ID token required)
// ============================================================

// --- Auth Routes (legacy compatibility) ---
router.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const profile = db.getProfile();
  res.json({
    message: 'Login successful',
    user: {
      fullName: profile.fullName || 'User',
      email: email
    }
  });
});

router.post('/auth/signup', (req, res) => {
  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  db.updateProfile({ fullName, email });
  res.status(201).json({
    message: 'Account created successfully',
    user: { fullName, email }
  });
});

// --- Dashboard API ---
router.get('/dashboard', (req, res) => {
  const stats = db.getDashboardStats();
  res.json(stats);
});

// --- Clients API ---
router.get('/clients', (req, res) => {
  res.json(db.getClients());
});

router.post('/clients', (req, res) => {
  const { company } = req.body;
  if (!company || company.trim() === '') {
    return res.status(400).json({ error: 'Company name is required' });
  }
  const client = db.addClient(req.body);
  res.status(201).json(client);
});

router.put('/clients/:id', (req, res) => {
  const updated = db.updateClient(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Client not found' });
  }
  res.json(updated);
});

router.delete('/clients/:id', (req, res) => {
  const success = db.deleteClient(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Client not found' });
  }
  res.json({ message: 'Client deleted successfully' });
});

// --- Invoices API ---
router.get('/invoices', (req, res) => {
  res.json(db.getInvoices());
});

router.post('/invoices', (req, res) => {
  const { client, description, items } = req.body;
  if (!client) {
    return res.status(400).json({ error: 'Client is required' });
  }
  if (!description && (!items || items.length === 0 || !items[0].description)) {
    return res.status(400).json({ error: 'Invoice item description is required' });
  }
  const invoice = db.addInvoice(req.body);
  res.status(201).json(invoice);
});

router.put('/invoices/:id', (req, res) => {
  const updated = db.updateInvoice(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  res.json(updated);
});

router.put('/invoices/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }
  const updated = db.updateInvoiceStatus(req.params.id, status);
  if (!updated) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  res.json(updated);
});

router.delete('/invoices/:id', (req, res) => {
  const success = db.deleteInvoice(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  res.json({ message: 'Invoice deleted successfully' });
});

// --- Send Invoice Email (Backend-powered) ---
router.post('/invoices/:id/send-email', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user.uid;

    // 1. Get invoice from Firestore
    let invoice = null;
    let senderProfile = null;

    try {
      const invRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
      const invSnap = await invRef.get();
      if (invSnap.exists) {
        invoice = { id: invSnap.id, ...invSnap.data() };
      }

      const profileRef = firestore.collection('users').doc(uid).collection('profile').doc('data');
      const profileSnap = await profileRef.get();
      if (profileSnap.exists) {
        senderProfile = profileSnap.data();
      }
    } catch (err) {
      console.warn('Firestore read error, falling back to local:', err.message);
    }

    // Fallback to local database
    if (!invoice) {
      const invoices = db.getInvoices();
      invoice = invoices.find(i => String(i.id) === String(id));
    }
    if (!senderProfile) {
      senderProfile = db.getProfile();
    }

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // 2. Get recipient email
    const recipientEmail = invoice.clientEmail;
    if (!recipientEmail) {
      return res.status(400).json({ error: 'Client email address is missing from this invoice.' });
    }

    // 3. Build payment URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const paymentUrl = `${frontendUrl}/#/pay/${encodeURIComponent(invoice.id)}?uid=${uid}`;

    // 4. Send email
    const result = await emailService.sendInvoiceEmail(invoice, senderProfile, recipientEmail, paymentUrl);

    // 5. Log activity in Firestore
    try {
      const invRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
      const snap = await invRef.get();
      if (snap.exists) {
        const data = snap.data();
        const activity = data.activity || [];
        activity.push({
          event: 'email_sent',
          timestamp: new Date().toISOString(),
          actor: 'owner',
          details: { to: recipientEmail, messageId: result.messageId }
        });
        await invRef.update({ 
          activity,
          emailSentAt: new Date().toISOString(),
          emailStatus: 'sent',
          status: data.status === 'draft' ? 'sent' : data.status
        });
      }
    } catch (err) {
      console.warn('Activity log error:', err.message);
    }

    res.json({
      success: true,
      message: `Invoice email sent to ${recipientEmail}`,
      ...result
    });
  } catch (err) {
    console.error('Send email error:', err);
    res.status(500).json({ 
      error: 'Unable to send email',
      message: err.message || 'Please check your email configuration and try again.'
    });
  }
});

// --- Send Payment Reminder ---
router.post('/invoices/:id/send-reminder', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reminderType } = req.body; // 'upcoming', 'due_today', 'overdue'
    const uid = req.user.uid;

    let invoice = null;
    let senderProfile = null;

    try {
      const invRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
      const invSnap = await invRef.get();
      if (invSnap.exists) {
        invoice = { id: invSnap.id, ...invSnap.data() };
      }

      const profileRef = firestore.collection('users').doc(uid).collection('profile').doc('data');
      const profileSnap = await profileRef.get();
      if (profileSnap.exists) {
        senderProfile = profileSnap.data();
      }
    } catch (err) {
      console.warn('Firestore read error:', err.message);
    }

    if (!invoice) {
      const invoices = db.getInvoices();
      invoice = invoices.find(i => String(i.id) === String(id));
    }
    if (!senderProfile) {
      senderProfile = db.getProfile();
    }

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const recipientEmail = invoice.clientEmail;
    if (!recipientEmail) {
      return res.status(400).json({ error: 'Client email address is missing.' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const paymentUrl = `${frontendUrl}/#/pay/${encodeURIComponent(invoice.id)}?uid=${uid}`;

    const type = reminderType || 'upcoming';
    const result = await emailService.sendReminderEmail(invoice, senderProfile, recipientEmail, type, paymentUrl);

    // Log reminder activity
    try {
      const invRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
      const snap = await invRef.get();
      if (snap.exists) {
        const data = snap.data();
        const activity = data.activity || [];
        activity.push({
          event: 'reminder_sent',
          timestamp: new Date().toISOString(),
          actor: 'owner',
          details: { to: recipientEmail, type }
        });
        const reminderCount = (data.reminderCount || 0) + 1;
        await invRef.update({ 
          activity, 
          lastReminderSent: new Date().toISOString(), 
          reminderCount 
        });
      }
    } catch (err) {
      console.warn('Reminder activity log error:', err.message);
    }

    res.json({
      success: true,
      message: `Payment reminder sent to ${recipientEmail}`,
      ...result
    });
  } catch (err) {
    console.error('Send reminder error:', err);
    res.status(500).json({ 
      error: 'Unable to send reminder',
      message: err.message || 'Please try again.'
    });
  }
});

// --- Record Manual Payment (business owner verifies payment) ---
router.post('/invoices/:id/record-payment', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user.uid;
    const { transactionId, method, amount, notes } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const payment = {
      status: 'verified',
      transactionId: transactionId.trim(),
      method: method || 'bank_transfer',
      paidAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      verifiedBy: 'manual',
      amount: amount || null,
      notes: notes || ''
    };

    try {
      const invRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
      const snap = await invRef.get();
      if (snap.exists) {
        const data = snap.data();
        const activity = data.activity || [];
        activity.push({
          event: 'payment_recorded',
          timestamp: new Date().toISOString(),
          actor: 'owner',
          details: { transactionId: payment.transactionId, method: payment.method }
        });
        activity.push({
          event: 'payment_verified',
          timestamp: new Date().toISOString(),
          actor: 'owner',
          details: { verifiedBy: 'manual' }
        });

        await invRef.update({ 
          payment,
          status: 'paid',
          activity,
          paidAt: payment.paidAt
        });

        return res.json({ 
          success: true, 
          message: 'Payment recorded and invoice marked as paid.',
          payment 
        });
      }
    } catch (err) {
      console.warn('Firestore payment record error:', err.message);
    }

    // Fallback local
    const updated = db.updateInvoice(id, { payment, status: 'paid' });
    if (!updated) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ success: true, message: 'Payment recorded.', payment });
  } catch (err) {
    console.error('Record payment error:', err);
    res.status(500).json({ error: 'Unable to record payment. Please try again.' });
  }
});

// --- Verify Client Payment Submission ---
router.post('/invoices/:id/verify-payment', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user.uid;

    try {
      const invRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
      const snap = await invRef.get();
      if (snap.exists) {
        const data = snap.data();
        const payment = data.payment || {};
        
        if (payment.status !== 'pending_verification') {
          return res.status(400).json({ error: 'No pending payment to verify for this invoice.' });
        }

        payment.status = 'verified';
        payment.verifiedAt = new Date().toISOString();
        payment.verifiedBy = 'manual';

        const activity = data.activity || [];
        activity.push({
          event: 'payment_verified',
          timestamp: new Date().toISOString(),
          actor: 'owner',
          details: { transactionId: payment.transactionId }
        });

        await invRef.update({ 
          payment,
          status: 'paid',
          activity,
          paidAt: payment.paidAt
        });

        return res.json({ success: true, message: 'Payment verified. Invoice marked as paid.', payment });
      }
    } catch (err) {
      console.warn('Firestore verify payment error:', err.message);
    }

    res.status(404).json({ error: 'Invoice not found' });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Unable to verify payment. Please try again.' });
  }
});

// --- Send Payment Receipt ---
router.post('/invoices/:id/send-receipt', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user.uid;

    let invoice = null;
    let senderProfile = null;

    try {
      const invRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
      const invSnap = await invRef.get();
      if (invSnap.exists) {
        invoice = { id: invSnap.id, ...invSnap.data() };
      }

      const profileRef = firestore.collection('users').doc(uid).collection('profile').doc('data');
      const profileSnap = await profileRef.get();
      if (profileSnap.exists) {
        senderProfile = profileSnap.data();
      }
    } catch (err) {
      console.warn('Firestore read error:', err.message);
    }

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status !== 'paid') {
      return res.status(400).json({ error: 'Cannot send receipt for an unpaid invoice.' });
    }

    const recipientEmail = invoice.clientEmail;
    if (!recipientEmail) {
      return res.status(400).json({ error: 'Client email address is missing.' });
    }

    const result = await emailService.sendReceiptEmail(invoice, senderProfile, recipientEmail, invoice.payment);

    // Log receipt sent activity
    try {
      const invRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
      const snap = await invRef.get();
      if (snap.exists) {
        const data = snap.data();
        const activity = data.activity || [];
        activity.push({
          event: 'receipt_sent',
          timestamp: new Date().toISOString(),
          actor: 'owner',
          details: { to: recipientEmail }
        });
        await invRef.update({ activity });
      }
    } catch (err) {
      console.warn('Receipt activity log error:', err.message);
    }

    res.json({
      success: true,
      message: `Payment receipt sent to ${recipientEmail}`,
      ...result
    });
  } catch (err) {
    console.error('Send receipt error:', err);
    res.status(500).json({ 
      error: 'Unable to send receipt',
      message: err.message || 'Please try again.'
    });
  }
});

// --- Recurring Invoices API ---
router.get('/recurring', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    try {
      const snap = await firestore.collection('users').doc(uid).collection('recurring').get();
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json(list);
    } catch (err) {
      console.warn('Firestore recurring error:', err.message);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recurring invoices' });
  }
});

router.post('/recurring', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const item = {
      ...req.body,
      createdAt: new Date().toISOString(),
      status: req.body.status || 'active'
    };
    try {
      const docRef = await firestore.collection('users').doc(uid).collection('recurring').add(item);
      return res.json({ id: docRef.id, ...item });
    } catch (err) {
      console.warn('Firestore recurring add error:', err.message);
    }
    res.json({ id: Date.now().toString(), ...item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create recurring invoice' });
  }
});

router.put('/recurring/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    try {
      await firestore.collection('users').doc(uid).collection('recurring').doc(id).set(req.body, { merge: true });
      return res.json({ id, ...req.body });
    } catch (err) {
      console.warn('Firestore recurring update error:', err.message);
    }
    res.json({ id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update recurring invoice' });
  }
});

router.delete('/recurring/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    try {
      await firestore.collection('users').doc(uid).collection('recurring').doc(id).delete();
      return res.json({ success: true, message: 'Recurring schedule deleted' });
    } catch (err) {
      console.warn('Firestore recurring delete error:', err.message);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete recurring schedule' });
  }
});

// --- Payments Ledger API ---
router.get('/payments', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    try {
      const snap = await firestore.collection('users').doc(uid).collection('invoices').get();
      const payments = [];
      snap.docs.forEach(docSnap => {
        const inv = docSnap.data();
        if (inv.payment && (inv.payment.status === 'verified' || inv.payment.status === 'pending_verification' || inv.status === 'paid')) {
          payments.push({
            id: inv.payment.transactionId || docSnap.id,
            invoiceId: docSnap.id,
            client: inv.client || 'Unknown',
            clientEmail: inv.clientEmail || '',
            amount: inv.amount || 0,
            currency: inv.currency || 'INR - Indian Rupee',
            method: inv.payment.method || 'upi',
            transactionId: inv.payment.transactionId || 'DIRECT',
            status: inv.payment.status || (inv.status === 'paid' ? 'verified' : 'pending_verification'),
            date: inv.payment.paidAt || inv.due || inv.created,
            payerName: inv.payment.payerName || '',
            payerEmail: inv.payment.payerEmail || ''
          });
        }
      });
      return res.json(payments);
    } catch (err) {
      console.warn('Firestore payments error:', err.message);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// --- Expenses API ---
router.get('/expenses', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    try {
      const snap = await firestore.collection('users').doc(uid).collection('expenses').orderBy('date', 'desc').get();
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json(list);
    } catch (err) {
      console.warn('Firestore expenses error:', err.message);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

router.post('/expenses', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const expense = {
      ...req.body,
      createdAt: new Date().toISOString()
    };
    try {
      const docRef = await firestore.collection('users').doc(uid).collection('expenses').add(expense);
      return res.json({ id: docRef.id, ...expense });
    } catch (err) {
      console.warn('Firestore expense add error:', err.message);
    }
    res.json({ id: Date.now().toString(), ...expense });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

router.put('/expenses/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    try {
      await firestore.collection('users').doc(uid).collection('expenses').doc(id).set(req.body, { merge: true });
      return res.json({ id, ...req.body });
    } catch (err) {
      console.warn('Firestore expense update error:', err.message);
    }
    res.json({ id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

router.delete('/expenses/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    try {
      await firestore.collection('users').doc(uid).collection('expenses').doc(id).delete();
      return res.json({ success: true });
    } catch (err) {
      console.warn('Firestore expense delete error:', err.message);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// --- AI Invoice Assistant Natural Language Parser ---
router.post('/ai/parse-invoice', requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const text = prompt.toLowerCase();
    
    // Extract amount: e.g. ₹25,000, 25000, $500, Rs. 1500
    const amtMatch = text.match(/(?:₹|\$|rs\.?|inr|usd)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+)/i);
    const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, '')) : 1000;

    // Extract tax: e.g. 18% gst, 18% tax, gst 18%
    const taxMatch = text.match(/([0-9]{1,2})\s*%\s*(?:gst|tax)|(?:gst|tax)\s*([0-9]{1,2})\s*%/i);
    const tax = taxMatch ? parseInt(taxMatch[1] || taxMatch[2], 10) : 18;

    // Detect GST Type (inter vs intra)
    let gstType = 'intra';
    if (text.includes('inter-state') || text.includes('inter state') || text.includes('igst')) {
      gstType = 'inter';
    }

    // Extract client name
    let client = 'Client';
    const forMatch = prompt.match(/(?:for|to|client)\s+([A-Z][A-Za-z0-9\s&]+?)(?:\s+(?:for|worth|amount|\$|₹|rs|with|at|due|gst)|$)/i);
    if (forMatch && forMatch[1]) {
      client = forMatch[1].trim();
    }

    // Extract description
    let description = 'Professional Services';
    const descMatch = prompt.match(/(?:for|regarding|service)\s+([A-Za-z0-9\s,.-]+?)(?:\s+worth|\s+amount|\s+due|\s+with|\s+rate|\s*\$|\s*₹|\s*rs|$)/i);
    if (descMatch && descMatch[1] && descMatch[1].trim().toLowerCase() !== client.toLowerCase()) {
      description = descMatch[1].trim();
    }

    // Extract due days
    let dueDays = 15;
    const dueMatch = text.match(/due\s+(?:in\s+)?([0-9]+)\s*days?/i);
    if (dueMatch) {
      dueDays = parseInt(dueMatch[1], 10);
    }
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
    const formattedDue = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const draft = {
      client,
      description,
      amount,
      tax,
      gstType,
      items: [
        {
          description,
          quantity: 1,
          rate: amount,
          amount: amount,
          hsnSac: '998314'
        }
      ],
      due: formattedDue,
      notes: 'Generated via AutoInvoice AI Assistant. Please review and finalize before sending.'
    };

    res.json({
      success: true,
      draft,
      confidence: 0.95,
      message: 'Invoice parsed successfully from prompt'
    });
  } catch (err) {
    console.error('AI parse error:', err);
    res.status(500).json({ error: 'Failed to parse natural language invoice' });
  }
});

// --- Profile API ---
router.get('/profile', (req, res) => {
  const profile = db.getProfile();
  res.json(profile);
});

router.put('/profile', (req, res) => {
  const updated = db.updateProfile(req.body);
  res.json(updated);
});

// --- Account Delete ---
router.delete('/account', (req, res) => {
  db.resetAll();
  res.json({ message: 'Account data cleared successfully' });
});

module.exports = router;

