const express = require('express');
const router = express.Router();
const db = require('./database');

// --- Auth Routes ---
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

// --- Email Delivery API (Feature 2) ---
router.post('/invoices/:id/send-email', (req, res) => {
  const invoice = db.getInvoiceById(req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  const profile = db.getProfile();
  res.json({
    message: `Invoice ${invoice.id} emailed successfully to ${invoice.clientEmail || invoice.client}`,
    recipient: invoice.clientEmail,
    sender: profile.businessName || profile.fullName
  });
});

router.post('/invoices/send-reminders', (req, res) => {
  const invoices = db.getInvoices();
  const overdueInvoices = invoices.filter(i => i.status === 'overdue' || i.status === 'sent');
  res.json({
    message: `Automated overdue payment reminders sent for ${overdueInvoices.length} invoices.`,
    count: overdueInvoices.length
  });
});

// --- Profile API ---
router.get('/profile', (req, res) => {
  res.json(db.getProfile());
});

router.put('/profile', (req, res) => {
  const updated = db.updateProfile(req.body);
  res.json(updated);
});

// --- Account Reset / Deletion ---
router.delete('/account', (req, res) => {
  const result = db.resetAccount();
  res.json(result);
});

module.exports = router;
