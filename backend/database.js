const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default initial data
const DEFAULT_CLIENTS = [
  {
    id: 1,
    company: 'Google',
    contact: 'John',
    email: 'zzaidd2003@gmail.com',
    country: 'United States',
    phone: '9999999999'
  }
];

const DEFAULT_INVOICES = [
  {
    id: 'INV-002',
    client: 'Google',
    clientEmail: 'zzaidd2003@gmail.com',
    amount: 1500,
    status: 'sent',
    created: 'Sep 18, 2025',
    due: 'Oct 18, 2025',
    description: 'Mobile App Design',
    items: [
      { description: 'Mobile App Design', quantity: 1, rate: 1271.19, amount: 1271.19 }
    ],
    quantity: 1,
    rate: 1271.19,
    discount: 0,
    tax: 18,
    subtotal: 1271.19,
    discountAmount: 0,
    taxAmount: 228.81,
    notes: 'Payment due within 30 days.'
  },
  {
    id: 'INV-001',
    client: 'Google',
    clientEmail: 'zzaidd2003@gmail.com',
    amount: 708,
    status: 'paid',
    created: 'Sep 18, 2025',
    due: 'Oct 18, 2025',
    description: 'Website Development',
    items: [
      { description: 'Website Development', quantity: 1, rate: 600, amount: 600 }
    ],
    quantity: 1,
    rate: 600,
    discount: 0,
    tax: 18,
    subtotal: 600,
    discountAmount: 0,
    taxAmount: 108,
    notes: 'Thank you for your business!'
  }
];

const DEFAULT_USER = {
  fullName: '',
  email: '',
  businessName: '',
  address: '',
  country: 'India',
  phone: '',
  website: '',
  taxId: '',
  currency: 'USD - US Dollar',
  logo: ''
};

// Helper to read JSON file safely
function readJSON(filename, fallback) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      writeJSON(filename, fallback);
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length === 0 ? fallback : parsed;
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    return fallback;
  }
}

// Helper to write JSON file safely
function writeJSON(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filename}:`, err.message);
  }
}

// In-memory data store with file persistence
let clients = readJSON('clients.json', DEFAULT_CLIENTS);
let invoices = readJSON('invoices.json', DEFAULT_INVOICES);
let user = readJSON('users.json', DEFAULT_USER);

const db = {
  // Clients CRUD
  getClients() {
    return clients;
  },

  getClientById(id) {
    return clients.find(c => c.id === Number(id));
  },

  addClient(data) {
    const newClient = {
      id: Date.now(),
      company: data.company || '',
      contact: data.contact || '',
      email: data.email || '',
      country: data.country || 'India',
      phone: data.phone || ''
    };
    clients.unshift(newClient);
    writeJSON('clients.json', clients);
    return newClient;
  },

  updateClient(id, data) {
    const index = clients.findIndex(c => c.id === Number(id));
    if (index === -1) return null;
    clients[index] = { ...clients[index], ...data };
    writeJSON('clients.json', clients);
    return clients[index];
  },

  deleteClient(id) {
    const beforeLength = clients.length;
    clients = clients.filter(c => c.id !== Number(id));
    writeJSON('clients.json', clients);
    return clients.length < beforeLength;
  },

  // Invoices CRUD
  getInvoices() {
    return invoices;
  },

  getInvoiceById(id) {
    return invoices.find(i => i.id === id);
  },

  addInvoice(data) {
    const nextNum = invoices.length + 1;
    const invId = `INV-${String(nextNum).padStart(3, '0')}`;

    const items = Array.isArray(data.items) && data.items.length > 0
      ? data.items
      : [{ description: data.description || 'Service', quantity: Number(data.quantity) || 1, rate: Number(data.rate) || 0, amount: (Number(data.quantity) || 1) * (Number(data.rate) || 0) }];

    const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.rate) || 0), 0);
    const discountPct = Number(data.discount) || 0;
    const discountAmount = (subtotal * discountPct) / 100;
    const taxable = subtotal - discountAmount;
    const taxPct = Number(data.tax) || 0;
    const taxAmount = (taxable * taxPct) / 100;
    const total = taxable + taxAmount;

    const today = new Date();
    const formattedCreated = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const newInvoice = {
      id: invId,
      client: data.client || '',
      clientEmail: data.clientEmail || '',
      amount: Number(total.toFixed(2)),
      status: data.status || 'sent',
      created: formattedCreated,
      due: data.due || 'Not set',
      description: items[0]?.description || data.description || '',
      items: items,
      quantity: items[0]?.quantity || 1,
      rate: items[0]?.rate || 0,
      discount: discountPct,
      tax: taxPct,
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      notes: data.notes || ''
    };

    invoices.unshift(newInvoice);
    writeJSON('invoices.json', invoices);
    return newInvoice;
  },

  updateInvoice(id, data) {
    const index = invoices.findIndex(i => i.id === id);
    if (index === -1) return null;
    invoices[index] = { ...invoices[index], ...data };
    writeJSON('invoices.json', invoices);
    return invoices[index];
  },

  updateInvoiceStatus(id, status) {
    const invoice = invoices.find(i => i.id === id);
    if (!invoice) return null;
    invoice.status = status;
    writeJSON('invoices.json', invoices);
    return invoice;
  },

  deleteInvoice(id) {
    const beforeLength = invoices.length;
    invoices = invoices.filter(i => i.id !== id);
    writeJSON('invoices.json', invoices);
    return invoices.length < beforeLength;
  },

  // Profile CRUD
  getProfile() {
    return user;
  },

  updateProfile(data) {
    user = { ...user, ...data };
    writeJSON('users.json', user);
    return user;
  },

  // Dashboard Stats
  getDashboardStats() {
    const totalRevenue = invoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const pendingAmount = invoices
      .filter(i => i.status === 'sent')
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const paidCount = invoices.filter(i => i.status === 'paid').length;
    const draftCount = invoices.filter(i => i.status === 'draft').length;

    const avgClientRevenue = clients.length > 0
      ? (invoices.reduce((sum, i) => sum + Number(i.amount), 0) / clients.length).toFixed(2)
      : '0.00';

    return {
      totalInvoices: invoices.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      pendingAmount: Number(pendingAmount.toFixed(2)),
      totalClients: clients.length,
      avgClientRevenue: Number(avgClientRevenue),
      paidCount,
      draftCount,
      recentInvoices: invoices.slice(0, 5)
    };
  },

  // Reset / Delete Account
  resetAccount() {
    clients = [];
    invoices = [];
    user = { ...DEFAULT_USER, fullName: '', businessName: '', address: '', phone: '', website: '', taxId: '', logo: '' };
    writeJSON('clients.json', clients);
    writeJSON('invoices.json', invoices);
    writeJSON('users.json', user);
    return { message: 'Account data cleared successfully' };
  }
};

module.exports = db;
