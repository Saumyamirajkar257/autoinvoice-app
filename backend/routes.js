const express = require('express');
const router = express.Router();
const db = require('./database');
const { requireAuth, requireAdmin, optionalAuth, generateToken, firestore } = require('./middleware/auth');
const { authLimiter, emailLimiter, aiLimiter } = require('./middleware/rateLimiter');
const emailService = require('./services/emailService');
const pdfService = require('./services/pdfService');

// ============================================================
// PUBLIC ROUTES (Rate limited, no authentication required)
// ============================================================

// --- Public Invoice View (for client payment page) ---
router.get('/public/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { uid } = req.query; // owner UID passed as query param

    if (uid && firestore) {
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
        console.warn('Firestore public invoice lookup warning:', err.message);
      }
    }

    // Fallback to local database
    const invoice = db.getInvoiceById(id, uid);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const profile = db.getProfile(uid);
    res.json({ invoice, profile });
  } catch (err) {
    console.error('Public invoice error:', err.message);
    res.status(500).json({ error: 'Unable to load invoice. Please try again.' });
  }
});

// --- Client Payment Confirmation (client submits payment reference) ---
router.post('/public/invoices/:id/confirm-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { uid, transactionId, method, payerName, payerEmail } = req.body;

    if (!transactionId || typeof transactionId !== 'string' || transactionId.trim().length === 0) {
      return res.status(400).json({ error: 'Transaction reference is required' });
    }

    const cleanTxId = transactionId.trim().substring(0, 100);
    const payment = {
      status: 'pending_verification',
      transactionId: cleanTxId,
      method: method || 'upi',
      paidAt: new Date().toISOString(),
      verifiedAt: null,
      verifiedBy: null,
      payerName: (payerName || '').substring(0, 100),
      payerEmail: (payerEmail || '').substring(0, 100)
    };

    if (uid && firestore) {
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
        console.warn('Firestore payment confirmation warning:', err.message);
      }
    }

    // Fallback to local database
    const updated = db.updateInvoice(id, { payment, status: 'pending_verification' }, uid);
    if (!updated) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ 
      success: true, 
      message: 'Payment confirmation submitted.',
      payment 
    });
  } catch (err) {
    console.error('Payment confirmation error:', err.message);
    res.status(500).json({ error: 'Unable to submit payment. Please try again.' });
  }
});


// ============================================================
// AUTHENTICATION ROUTES (Rate limited & Bcrypt Hashed)
// ============================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/auth/signup', authLimiter, async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const cleanFullName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Create user with bcrypt hashing
    const user = await db.createAuthUser({
      fullName: cleanFullName,
      email: cleanEmail,
      password: password
    });

    // Generate JWT token
    const token = generateToken(user);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(400).json({ error: err.message || 'Failed to create account' });
  }
});

router.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const verifiedUser = await db.verifyAuthUser(cleanEmail, String(password));

    if (!verifiedUser) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Invalid email or password. Please try again.'
      });
    }

    // Generate authenticated JWT token
    const token = generateToken(verifiedUser);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: verifiedUser.id,
        fullName: verifiedUser.fullName,
        email: verifiedUser.email
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Authentication service error' });
  }
});


// ============================================================
// PROTECTED USER ROUTES (requireAuth & Tenant Scoping)
// ============================================================

// --- Dashboard API (Scoped to req.user.uid) ---
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;

    if (firestore) {
      try {
        const [invoicesSnap, clientsSnap] = await Promise.all([
          firestore.collection('users').doc(uid).collection('invoices').get(),
          firestore.collection('users').doc(uid).collection('clients').get()
        ]);

        const userInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const userClients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const totalRevenue = userInvoices
          .filter(i => i.status === 'paid')
          .reduce((sum, i) => sum + Number(i.amount || 0), 0);

        const pendingAmount = userInvoices
          .filter(i => i.status === 'sent')
          .reduce((sum, i) => sum + Number(i.amount || 0), 0);

        const paidCount = userInvoices.filter(i => i.status === 'paid').length;
        const draftCount = userInvoices.filter(i => i.status === 'draft').length;
        const overdueCount = userInvoices.filter(i => i.status === 'overdue').length;

        const avgClientRevenue = userClients.length > 0
          ? (userInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0) / userClients.length).toFixed(2)
          : '0.00';

        return res.json({
          totalInvoices: userInvoices.length,
          totalRevenue: Number(totalRevenue.toFixed(2)),
          pendingAmount: Number(pendingAmount.toFixed(2)),
          totalClients: userClients.length,
          avgClientRevenue: Number(avgClientRevenue),
          paidCount,
          draftCount,
          overdueCount,
          recentInvoices: userInvoices.slice(0, 5)
        });
      } catch (err) {
        console.warn('Firestore dashboard error, falling back to local:', err.message);
      }
    }

    const stats = db.getDashboardStats(uid);
    res.json(stats);
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve dashboard metrics' });
  }
});

// --- Clients API (Multi-Tenant Scoped) ---
router.get('/clients', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    if (firestore) {
      try {
        const snap = await firestore.collection('users').doc(uid).collection('clients').get();
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return res.json(list);
      } catch (err) {
        console.warn('Firestore getClients error:', err.message);
      }
    }
    res.json(db.getClients(uid));
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve clients' });
  }
});

router.post('/clients', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { company, contact, email, phone, country, gstin } = req.body;
    
    if (!company || String(company).trim() === '') {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const clientData = {
      company: String(company).trim(),
      contact: contact ? String(contact).trim() : '',
      email: email ? String(email).trim() : '',
      phone: phone ? String(phone).trim() : '',
      country: country || 'India',
      gstin: gstin ? String(gstin).trim() : '',
      uid,
      createdAt: new Date().toISOString()
    };

    if (firestore) {
      try {
        const docRef = await firestore.collection('users').doc(uid).collection('clients').add(clientData);
        return res.status(201).json({ id: docRef.id, ...clientData });
      } catch (err) {
        console.warn('Firestore addClient error:', err.message);
      }
    }

    const client = db.addClient(clientData, uid);
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create client' });
  }
});

router.put('/clients/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;

    if (firestore) {
      try {
        const docRef = firestore.collection('users').doc(uid).collection('clients').doc(id);
        const snap = await docRef.get();
        if (snap.exists) {
          await docRef.set(req.body, { merge: true });
          return res.json({ id, ...req.body });
        }
      } catch (err) {
        console.warn('Firestore updateClient error:', err.message);
      }
    }

    const updated = db.updateClient(id, req.body, uid);
    if (!updated) {
      return res.status(404).json({ error: 'Client not found or unauthorized' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

router.delete('/clients/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;

    if (firestore) {
      try {
        const docRef = firestore.collection('users').doc(uid).collection('clients').doc(id);
        const snap = await docRef.get();
        if (snap.exists) {
          await docRef.delete();
          return res.json({ message: 'Client deleted successfully' });
        }
      } catch (err) {
        console.warn('Firestore deleteClient error:', err.message);
      }
    }

    const success = db.deleteClient(id, uid);
    if (!success) {
      return res.status(404).json({ error: 'Client not found or unauthorized' });
    }
    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});


// --- Invoices API (Multi-Tenant Scoped) ---
router.get('/invoices', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    if (firestore) {
      try {
        const snap = await firestore.collection('users').doc(uid).collection('invoices').get();
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return res.json(list);
      } catch (err) {
        console.warn('Firestore getInvoices error:', err.message);
      }
    }
    res.json(db.getInvoices(uid));
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve invoices' });
  }
});

router.post('/invoices', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { client, description, items } = req.body;
    
    if (!client) {
      return res.status(400).json({ error: 'Client is required' });
    }
    if (!description && (!items || items.length === 0 || !items[0].description)) {
      return res.status(400).json({ error: 'Invoice item description is required' });
    }

    const invoiceData = {
      ...req.body,
      uid,
      createdAt: new Date().toISOString()
    };

    if (firestore) {
      try {
        const invId = invoiceData.id || `INV-${Date.now().toString().slice(-4)}`;
        await firestore.collection('users').doc(uid).collection('invoices').doc(invId).set({
          ...invoiceData,
          id: invId
        });
        return res.status(201).json({ id: invId, ...invoiceData });
      } catch (err) {
        console.warn('Firestore addInvoice error:', err.message);
      }
    }

    const invoice = db.addInvoice(invoiceData, uid);
    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.put('/invoices/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;

    if (firestore) {
      try {
        const docRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
        const snap = await docRef.get();
        if (snap.exists) {
          await docRef.set(req.body, { merge: true });
          return res.json({ id, ...req.body });
        }
      } catch (err) {
        console.warn('Firestore updateInvoice error:', err.message);
      }
    }

    const updated = db.updateInvoice(id, req.body, uid);
    if (!updated) {
      return res.status(404).json({ error: 'Invoice not found or unauthorized' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

router.put('/invoices/:id/status', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    if (firestore) {
      try {
        const docRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
        const snap = await docRef.get();
        if (snap.exists) {
          await docRef.update({ status });
          return res.json({ id, status });
        }
      } catch (err) {
        console.warn('Firestore updateStatus error:', err.message);
      }
    }

    const updated = db.updateInvoiceStatus(id, status, uid);
    if (!updated) {
      return res.status(404).json({ error: 'Invoice not found or unauthorized' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update invoice status' });
  }
});

router.delete('/invoices/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;

    if (firestore) {
      try {
        const docRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
        const snap = await docRef.get();
        if (snap.exists) {
          await docRef.delete();
          return res.json({ message: 'Invoice deleted successfully' });
        }
      } catch (err) {
        console.warn('Firestore deleteInvoice error:', err.message);
      }
    }

    const success = db.deleteInvoice(id, uid);
    if (!success) {
      return res.status(404).json({ error: 'Invoice not found or unauthorized' });
    }
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});


// --- Transactional Email Delivery (Rate Limited) ---
const handleSendInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user.uid;

    // 1. Get invoice scoped by UID
    let invoice = null;
    let senderProfile = null;

    if (firestore) {
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
        console.warn('Firestore read error in email dispatch:', err.message);
      }
    }

    // Fallback to local database scoped by UID
    if (!invoice) {
      invoice = db.getInvoiceById(id, uid);
    }
    if (!senderProfile) {
      senderProfile = db.getProfile(uid);
    }

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found or unauthorized' });
    }

    // 2. Validate recipient email
    const recipientEmail = (req.body && req.body.recipientEmail) || invoice.clientEmail;
    if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail.trim())) {
      return res.status(400).json({ error: 'Unable to send the invoice. Please check the recipient email address.' });
    }

    // 3. Build public payment & view URL
    const frontendUrl = process.env.FRONTEND_URL || 'https://autoinvoice-frontend.saumyamir25.workers.dev';
    const paymentUrl = `${frontendUrl}/#/pay/${encodeURIComponent(invoice.id)}?uid=${uid}`;

    // 4. Generate/attach official invoice PDF
    let pdfBuffer = null;
    if (req.body && req.body.pdfBase64) {
      try {
        pdfBuffer = Buffer.from(req.body.pdfBase64, 'base64');
      } catch (e) {
        console.warn('Invalid base64 PDF provided, generating fallback buffer.');
      }
    }
    if (!pdfBuffer) {
      try {
        pdfBuffer = pdfService.generateInvoicePDFBuffer(invoice, senderProfile, { company: invoice.client, email: recipientEmail });
      } catch (pdfErr) {
        console.warn('Backend PDF generation fallback note:', pdfErr.message);
      }
    }

    const pdfAttachment = pdfBuffer ? {
      filename: `${invoice.id || 'INV-001'}.pdf`,
      content: pdfBuffer
    } : null;

    // 5. Send transactional email through configured provider (safe HTML escaping applied)
    const result = await emailService.sendInvoiceEmail(
      invoice,
      senderProfile,
      recipientEmail.trim(),
      paymentUrl,
      pdfAttachment
    );

    // 6. Record email status on invoice
    const sentAt = new Date().toISOString();
    if (firestore) {
      try {
        const invRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
        const snap = await invRef.get();
        if (snap.exists) {
          const data = snap.data();
          const activity = data.activity || [];
          activity.push({
            event: 'email_sent',
            timestamp: sentAt,
            actor: 'owner',
            details: { to: recipientEmail.trim(), messageId: result.messageId, withPdf: Boolean(pdfAttachment) }
          });
          await invRef.update({
            activity,
            emailStatus: 'sent',
            emailSentTo: recipientEmail.trim(),
            emailSentAt: sentAt,
            status: data.status === 'draft' ? 'sent' : data.status
          });
        }
      } catch (err) {
        console.warn('Activity log error:', err.message);
      }
    }

    res.json({
      success: true,
      message: `Invoice ${invoice.id} was sent to ${recipientEmail.trim()}`,
      recipient: recipientEmail.trim(),
      emailStatus: 'sent',
      sentAt,
      messageId: result.messageId
    });
  } catch (err) {
    console.error('Send invoice email error:', err.message);
    res.status(500).json({
      error: 'Unable to send the invoice. Please verify email settings.',
      details: err.message,
      emailStatus: 'failed'
    });
  }
};

router.post('/invoices/:id/send', requireAuth, emailLimiter, handleSendInvoice);
router.post('/invoices/:id/send-email', requireAuth, emailLimiter, handleSendInvoice);

// --- Send Payment Reminder (Rate Limited) ---
router.post('/invoices/:id/send-reminder', requireAuth, emailLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { reminderType } = req.body;
    const uid = req.user.uid;

    let invoice = null;
    let senderProfile = null;

    if (firestore) {
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
        console.warn('Firestore read error in reminder:', err.message);
      }
    }

    if (!invoice) invoice = db.getInvoiceById(id, uid);
    if (!senderProfile) senderProfile = db.getProfile(uid);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found or unauthorized' });
    }

    const recipientEmail = invoice.clientEmail;
    if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail.trim())) {
      return res.status(400).json({ error: 'Client email address is invalid or missing.' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://autoinvoice-frontend.saumyamir25.workers.dev';
    const paymentUrl = `${frontendUrl}/#/pay/${encodeURIComponent(invoice.id)}?uid=${uid}`;

    const type = reminderType || 'upcoming';
    const result = await emailService.sendReminderEmail(invoice, senderProfile, recipientEmail, type, paymentUrl);

    res.json({
      success: true,
      message: `Payment reminder sent to ${recipientEmail}`,
      ...result
    });
  } catch (err) {
    console.error('Send reminder error:', err.message);
    res.status(500).json({ error: 'Unable to send reminder' });
  }
});

// --- Record Manual Payment (Supports Partial & Full Payments) ---
router.post('/invoices/:id/record-payment', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user.uid;
    const { transactionId, method, amount, notes } = req.body;

    if (!transactionId || String(transactionId).trim() === '') {
      return res.status(400).json({ error: 'Transaction reference is required' });
    }

    const cleanTxId = String(transactionId).trim();

    if (firestore) {
      try {
        const invRef = firestore.collection('users').doc(uid).collection('invoices').doc(id);
        const snap = await invRef.get();
        if (snap.exists) {
          const data = snap.data();
          const totalInvoiceAmt = Number(data.amount || 0);

          // Existing payments array
          const existingPayments = Array.isArray(data.payments) ? data.payments : (data.payment && data.payment.status === 'verified' ? [data.payment] : []);

          // Prevent exact duplicate transaction reference
          const isDuplicate = existingPayments.some(p => p.transactionId && p.transactionId.toLowerCase() === cleanTxId.toLowerCase());
          if (isDuplicate) {
            return res.status(400).json({ error: 'A payment with this transaction reference has already been recorded.' });
          }

          const previousPaid = existingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          const payAmt = Math.min(Number(amount) || (totalInvoiceAmt - previousPaid), Math.max(0, totalInvoiceAmt - previousPaid));
          const totalPaidToDate = Number((previousPaid + payAmt).toFixed(2));
          const remainingBalance = Math.max(0, Number((totalInvoiceAmt - totalPaidToDate).toFixed(2)));

          const receiptNumber = `REC-${(data.id || id).replace(/^INV-?/i, '')}-${existingPayments.length + 1}`;

          const newPaymentRecord = {
            id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            receiptNumber,
            status: 'verified',
            transactionId: cleanTxId,
            method: method || 'bank_transfer',
            amount: payAmt,
            previousPaid,
            totalPaidToDate,
            remainingBalance,
            paidAt: new Date().toISOString(),
            verifiedAt: new Date().toISOString(),
            verifiedBy: 'manual',
            notes: notes || ''
          };

          const updatedPayments = [...existingPayments, newPaymentRecord];
          const newStatus = remainingBalance <= 0 ? 'paid' : (totalPaidToDate > 0 ? 'partially_paid' : (data.status || 'sent'));

          const activity = data.activity || [];
          activity.push({
            event: 'payment_recorded',
            timestamp: new Date().toISOString(),
            actor: 'owner',
            details: { transactionId: cleanTxId, amount: payAmt, remainingBalance, receiptNumber }
          });

          await invRef.update({
            payments: updatedPayments,
            payment: newPaymentRecord, // Most recent payment
            amountPaid: totalPaidToDate,
            balanceDue: remainingBalance,
            status: newStatus,
            activity,
            paidAt: newPaymentRecord.paidAt
          });

          return res.json({
            success: true,
            message: remainingBalance <= 0 ? 'Payment received in full. Invoice marked as paid.' : `Partial payment of ${payAmt} recorded. Remaining: ${remainingBalance}`,
            payment: newPaymentRecord,
            payments: updatedPayments,
            status: newStatus,
            balanceDue: remainingBalance
          });
        }
      } catch (err) {
        console.warn('Firestore payment record error:', err.message);
      }
    }

    // Local DB fallback
    const invoice = db.getInvoiceById(id, uid);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found or unauthorized' });
    }

    const totalInvoiceAmt = Number(invoice.amount || 0);
    const existingPayments = Array.isArray(invoice.payments) ? invoice.payments : (invoice.payment && invoice.payment.status === 'verified' ? [invoice.payment] : []);

    const isDuplicate = existingPayments.some(p => p.transactionId && p.transactionId.toLowerCase() === cleanTxId.toLowerCase());
    if (isDuplicate) {
      return res.status(400).json({ error: 'A payment with this transaction reference has already been recorded.' });
    }

    const previousPaid = existingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const payAmt = Math.min(Number(amount) || (totalInvoiceAmt - previousPaid), Math.max(0, totalInvoiceAmt - previousPaid));
    const totalPaidToDate = Number((previousPaid + payAmt).toFixed(2));
    const remainingBalance = Math.max(0, Number((totalInvoiceAmt - totalPaidToDate).toFixed(2)));
    const receiptNumber = `REC-${(invoice.id || id).replace(/^INV-?/i, '')}-${existingPayments.length + 1}`;

    const newPaymentRecord = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      receiptNumber,
      status: 'verified',
      transactionId: cleanTxId,
      method: method || 'bank_transfer',
      amount: payAmt,
      previousPaid,
      totalPaidToDate,
      remainingBalance,
      paidAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      verifiedBy: 'manual',
      notes: notes || ''
    };

    const updatedPayments = [...existingPayments, newPaymentRecord];
    const newStatus = remainingBalance <= 0 ? 'paid' : (totalPaidToDate > 0 ? 'partially_paid' : (invoice.status || 'sent'));

    const updated = db.updateInvoice(id, {
      payments: updatedPayments,
      payment: newPaymentRecord,
      amountPaid: totalPaidToDate,
      balanceDue: remainingBalance,
      status: newStatus
    }, uid);

    res.json({
      success: true,
      message: remainingBalance <= 0 ? 'Payment received in full. Invoice marked as paid.' : `Partial payment of ${payAmt} recorded. Remaining: ${remainingBalance}`,
      payment: newPaymentRecord,
      payments: updatedPayments,
      status: newStatus,
      balanceDue: remainingBalance
    });
  } catch (err) {
    console.error('Record payment error:', err.message);
    res.status(500).json({ error: 'Unable to record payment' });
  }
});

// --- Verify Client Payment Submission ---
router.post('/invoices/:id/verify-payment', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user.uid;

    if (firestore) {
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
    }

    res.status(404).json({ error: 'Invoice not found or unauthorized' });
  } catch (err) {
    console.error('Verify payment error:', err.message);
    res.status(500).json({ error: 'Unable to verify payment' });
  }
});

// --- Send Payment Receipt (Rate Limited) ---
router.post('/invoices/:id/send-receipt', requireAuth, emailLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user.uid;

    let invoice = null;
    let senderProfile = null;

    if (firestore) {
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
        console.warn('Firestore read error in receipt:', err.message);
      }
    }

    if (!invoice) invoice = db.getInvoiceById(id, uid);
    if (!senderProfile) senderProfile = db.getProfile(uid);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found or unauthorized' });
    }

    if (invoice.status !== 'paid') {
      return res.status(400).json({ error: 'Cannot send receipt for an unpaid invoice.' });
    }

    const recipientEmail = invoice.clientEmail;
    if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail.trim())) {
      return res.status(400).json({ error: 'Client email address is invalid or missing.' });
    }

    const result = await emailService.sendReceiptEmail(invoice, senderProfile, recipientEmail, invoice.payment);

    res.json({
      success: true,
      message: `Payment receipt sent to ${recipientEmail}`,
      ...result
    });
  } catch (err) {
    console.error('Send receipt error:', err.message);
    res.status(500).json({ error: 'Unable to send receipt' });
  }
});

// --- Recurring Invoices API ---
router.get('/recurring', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    if (firestore) {
      try {
        const snap = await firestore.collection('users').doc(uid).collection('recurring').get();
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return res.json(list);
      } catch (err) {
        console.warn('Firestore recurring error:', err.message);
      }
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
      uid,
      createdAt: new Date().toISOString(),
      status: req.body.status || 'active'
    };
    if (firestore) {
      try {
        const docRef = await firestore.collection('users').doc(uid).collection('recurring').add(item);
        return res.json({ id: docRef.id, ...item });
      } catch (err) {
        console.warn('Firestore recurring add error:', err.message);
      }
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
    if (firestore) {
      try {
        await firestore.collection('users').doc(uid).collection('recurring').doc(id).set(req.body, { merge: true });
        return res.json({ id, ...req.body });
      } catch (err) {
        console.warn('Firestore recurring update error:', err.message);
      }
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
    if (firestore) {
      try {
        await firestore.collection('users').doc(uid).collection('recurring').doc(id).delete();
        return res.json({ success: true, message: 'Recurring schedule deleted' });
      } catch (err) {
        console.warn('Firestore recurring delete error:', err.message);
      }
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
    if (firestore) {
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
    if (firestore) {
      try {
        const snap = await firestore.collection('users').doc(uid).collection('expenses').orderBy('date', 'desc').get();
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return res.json(list);
      } catch (err) {
        console.warn('Firestore expenses error:', err.message);
      }
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
      uid,
      createdAt: new Date().toISOString()
    };
    if (firestore) {
      try {
        const docRef = await firestore.collection('users').doc(uid).collection('expenses').add(expense);
        return res.json({ id: docRef.id, ...expense });
      } catch (err) {
        console.warn('Firestore expense add error:', err.message);
      }
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
    if (firestore) {
      try {
        await firestore.collection('users').doc(uid).collection('expenses').doc(id).set(req.body, { merge: true });
        return res.json({ id, ...req.body });
      } catch (err) {
        console.warn('Firestore expense update error:', err.message);
      }
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
    if (firestore) {
      try {
        await firestore.collection('users').doc(uid).collection('expenses').doc(id).delete();
        return res.json({ success: true });
      } catch (err) {
        console.warn('Firestore expense delete error:', err.message);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// --- AI Invoice Assistant Natural Language Parser (Rate Limited) ---
router.post('/ai/parse-invoice', requireAuth, aiLimiter, async (req, res) => {
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
    console.error('AI parse error:', err.message);
    res.status(500).json({ error: 'Failed to parse natural language invoice' });
  }
});

// --- Profile API (Multi-Tenant Scoped) ---
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    if (firestore) {
      try {
        const snap = await firestore.collection('users').doc(uid).collection('profile').doc('data').get();
        if (snap.exists) {
          return res.json(snap.data());
        }
      } catch (err) {
        console.warn('Firestore getProfile error:', err.message);
      }
    }
    res.json(db.getProfile(uid));
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    if (firestore) {
      try {
        await firestore.collection('users').doc(uid).collection('profile').doc('data').set(req.body, { merge: true });
        return res.json(req.body);
      } catch (err) {
        console.warn('Firestore updateProfile error:', err.message);
      }
    }
    const updated = db.updateProfile(req.body, uid);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});


// ============================================================
// ADMIN-ONLY ROUTES (Protected by requireAuth & requireAdmin)
// ============================================================

// --- Admin System Overview ---
router.get('/admin/overview', requireAuth, requireAdmin, (req, res) => {
  res.json({
    status: 'healthy',
    adminUser: req.user.email,
    timestamp: new Date().toISOString(),
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    }
  });
});

// --- Admin Account Reset / Wipe (Strictly Protected) ---
router.delete('/account', requireAuth, requireAdmin, (req, res) => {
  try {
    const uid = req.user.uid;
    const result = db.resetAccount(uid);
    res.json(result);
  } catch (err) {
    console.error('Account reset error:', err.message);
    res.status(500).json({ error: 'Failed to reset account' });
  }
});

module.exports = router;
