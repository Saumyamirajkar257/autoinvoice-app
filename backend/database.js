const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data folder exists with secure directory permissions
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}

// Default initial data
const DEFAULT_CLIENTS = [
  {
    id: 1,
    uid: 'default',
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
    uid: 'default',
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
    uid: 'default',
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
  fullName: 'Saumya Mirajkar',
  email: 'Saumyamir25@gmail.com',
  businessName: 'AutoInvoice',
  upiId: 'Saumyamir25@oksbi',
  customQrUrl: '/qr_code.png',
  address: '',
  country: 'India',
  phone: '',
  website: '',
  currency: 'INR - Indian Rupee',
  logo: ''
};

// Helper to read JSON file safely with path validation
function readJSON(filename, fallback) {
  // Prevent path traversal
  const safeName = path.basename(filename);
  const filePath = path.join(DATA_DIR, safeName);
  try {
    if (!fs.existsSync(filePath)) {
      writeJSON(safeName, fallback);
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length === 0 ? fallback : parsed;
  } catch (err) {
    console.error(`Error reading ${safeName}:`, err.message);
    return fallback;
  }
}

// Helper to write JSON file safely
function writeJSON(filename, data) {
  const safeName = path.basename(filename);
  const filePath = path.join(DATA_DIR, safeName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
  } catch (err) {
    console.error(`Error writing ${safeName}:`, err.message);
  }
}

// In-memory data store with file persistence
let clients = readJSON('clients.json', DEFAULT_CLIENTS);
let invoices = readJSON('invoices.json', DEFAULT_INVOICES);
let user = readJSON('users.json', DEFAULT_USER);
let authUsers = readJSON('auth_users.json', []);

const db = {
  // Auth User Store with Password Hashing
  async findAuthUserByEmail(email) {
    if (!email) return null;
    const clean = String(email).trim().toLowerCase();
    return authUsers.find(u => u.email.toLowerCase() === clean) || null;
  },

  async createAuthUser({ fullName, email, password }) {
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await this.findAuthUserByEmail(cleanEmail);
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    // Hash password with bcrypt (12 rounds)
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      fullName: String(fullName).trim(),
      email: cleanEmail,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    authUsers.push(newUser);
    writeJSON('auth_users.json', authUsers);
    return { id: newUser.id, fullName: newUser.fullName, email: newUser.email };
  },

  async verifyAuthUser(email, password) {
    const userRecord = await this.findAuthUserByEmail(email);
    if (!userRecord || !userRecord.passwordHash) {
      return null;
    }
    const isValid = await bcrypt.compare(password, userRecord.passwordHash);
    if (!isValid) return null;
    return { id: userRecord.id, fullName: userRecord.fullName, email: userRecord.email };
  },

  // Clients CRUD (Scoped by UID)
  getClients(uid = null) {
    if (!uid) return clients;
    return clients.filter(c => !c.uid || c.uid === uid || c.uid === 'default');
  },

  getClientById(id, uid = null) {
    return clients.find(c => String(c.id) === String(id) && (!uid || !c.uid || c.uid === uid || c.uid === 'default'));
  },

  addClient(data, uid = null) {
    const newClient = {
      id: Date.now(),
      uid: uid || 'default',
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

  updateClient(id, data, uid = null) {
    const index = clients.findIndex(c => String(c.id) === String(id) && (!uid || !c.uid || c.uid === uid || c.uid === 'default'));
    if (index === -1) return null;
    clients[index] = { ...clients[index], ...data, id: clients[index].id, uid: clients[index].uid };
    writeJSON('clients.json', clients);
    return clients[index];
  },

  deleteClient(id, uid = null) {
    const beforeLength = clients.length;
    clients = clients.filter(c => !(String(c.id) === String(id) && (!uid || !c.uid || c.uid === uid || c.uid === 'default')));
    writeJSON('clients.json', clients);
    return clients.length < beforeLength;
  },

  // Invoices CRUD (Scoped by UID)
  getInvoices(uid = null) {
    if (!uid) return invoices;
    return invoices.filter(i => !i.uid || i.uid === uid || i.uid === 'default');
  },

  getInvoiceById(id, uid = null) {
    return invoices.find(i => String(i.id).toLowerCase() === String(id).toLowerCase() && (!uid || !i.uid || i.uid === uid || i.uid === 'default'));
  },

  addInvoice(data, uid = null) {
    const nextNum = invoices.length + 1;
    const invId = data.id || `INV-${String(nextNum).padStart(3, '0')}`;

    const items = Array.isArray(data.items) && data.items.length > 0
      ? data.items
      : [{ description: data.description || 'Service', quantity: Number(data.quantity) || 1, rate: Number(data.rate) || 0, amount: (Number(data.quantity) || 1) * (Number(data.rate) || 0) }];

    const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.rate) || 0), 0);
    const discountPct = Math.max(0, Math.min(100, Number(data.discount) || 0));
    const discountAmount = (subtotal * discountPct) / 100;
    const taxable = Math.max(0, subtotal - discountAmount);
    const taxPct = Math.max(0, Math.min(100, Number(data.tax) || 0));
    const taxAmount = (taxable * taxPct) / 100;
    const total = taxable + taxAmount;

    const today = new Date();
    const formattedCreated = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const newInvoice = {
      id: invId,
      uid: uid || 'default',
      client: data.client || '',
      clientEmail: data.clientEmail || '',
      amount: Number(total.toFixed(2)),
      status: data.status || 'sent',
      created: formattedCreated,
      due: data.due || 'Not set',
      language: data.language || 'English',
      currency: data.currency || 'INR - Indian Rupee',
      description: items[0]?.description || data.description || '',
      items: items,
      quantity: items[0]?.quantity || 1,
      rate: items[0]?.rate || 0,
      discount: discountPct,
      tax: taxPct,
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      notes: data.notes || '',
      activity: [{
        event: 'created',
        timestamp: today.toISOString(),
        actor: 'owner',
        details: { status: data.status || 'sent' }
      }]
    };

    invoices.unshift(newInvoice);
    writeJSON('invoices.json', invoices);
    return newInvoice;
  },

  updateInvoice(id, data, uid = null) {
    const index = invoices.findIndex(i => String(i.id).toLowerCase() === String(id).toLowerCase() && (!uid || !i.uid || i.uid === uid || i.uid === 'default'));
    if (index === -1) return null;
    invoices[index] = { ...invoices[index], ...data, id: invoices[index].id, uid: invoices[index].uid };
    writeJSON('invoices.json', invoices);
    return invoices[index];
  },

  updateInvoiceStatus(id, status, uid = null) {
    const invoice = this.getInvoiceById(id, uid);
    if (!invoice) return null;
    invoice.status = status;
    writeJSON('invoices.json', invoices);
    return invoice;
  },

  deleteInvoice(id, uid = null) {
    const beforeLength = invoices.length;
    invoices = invoices.filter(i => !(String(i.id).toLowerCase() === String(id).toLowerCase() && (!uid || !i.uid || i.uid === uid || i.uid === 'default')));
    writeJSON('invoices.json', invoices);
    return invoices.length < beforeLength;
  },

  // Profile CRUD
  getProfile(uid = null) {
    return user;
  },

  updateProfile(data, uid = null) {
    user = { ...user, ...data };
    writeJSON('users.json', user);
    return user;
  },

  // Dashboard Stats (Scoped by UID)
  getDashboardStats(uid = null) {
    const userInvoices = this.getInvoices(uid);
    const userClients = this.getClients(uid);

    const totalRevenue = userInvoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);

    const pendingAmount = userInvoices
      .filter(i => i.status === 'sent')
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);

    const paidCount = userInvoices.filter(i => i.status === 'paid').length;
    const draftCount = userInvoices.filter(i => i.status === 'draft').length;

    const avgClientRevenue = userClients.length > 0
      ? (userInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0) / userClients.length).toFixed(2)
      : '0.00';

    return {
      totalInvoices: userInvoices.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      pendingAmount: Number(pendingAmount.toFixed(2)),
      totalClients: userClients.length,
      avgClientRevenue: Number(avgClientRevenue),
      paidCount,
      draftCount,
      recentInvoices: userInvoices.slice(0, 5)
    };
  },

  // Reset / Delete Account
  resetAccount(uid = null) {
    if (uid && uid !== 'default') {
      clients = clients.filter(c => c.uid !== uid);
      invoices = invoices.filter(i => i.uid !== uid);
    } else {
      clients = [];
      invoices = [];
      user = { ...DEFAULT_USER, fullName: '', businessName: '', address: '', phone: '', website: '', logo: '' };
    }
    writeJSON('clients.json', clients);
    writeJSON('invoices.json', invoices);
    writeJSON('users.json', user);
    return { message: 'Account data cleared successfully' };
  }
};

module.exports = db;
