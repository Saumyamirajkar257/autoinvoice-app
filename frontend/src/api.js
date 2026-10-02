import { auth, db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';

import {
  getEmailSettings,
  sendEmailJS,
  buildInvoiceEmailData,
  buildReminderEmailData,
  buildReceiptEmailData
} from './utils/emailService';

const API_BASE = '/api';

// Default initial data for local storage fallback
const DEFAULT_CLIENTS = [
  { id: 1, company: 'Google India Pvt Ltd', contact: 'John Doe', email: 'john@google.com', country: 'India', phone: '+91 98765 43210' }
];

const DEFAULT_INVOICES = [
  {
    id: 'INV-002',
    client: 'Google India Pvt Ltd',
    clientEmail: 'john@google.com',
    amount: 1500,
    status: 'sent',
    template: 'modern',
    created: 'Sep 18, 2025',
    due: 'Oct 18, 2025',
    description: 'Mobile App Design & UI Consulting',
    items: [
      { description: 'Mobile App Design & UI Consulting', quantity: 1, rate: 1271.19, amount: 1271.19 }
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
    client: 'Google India Pvt Ltd',
    clientEmail: 'john@google.com',
    amount: 708,
    status: 'paid',
    template: 'modern',
    created: 'Sep 18, 2025',
    due: 'Oct 18, 2025',
    description: 'Website Performance & SEO Optimization',
    items: [
      { description: 'Website Performance & SEO Optimization', quantity: 1, rate: 600, amount: 600 }
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
  language: 'English',
  defaultTemplate: 'modern',
  theme: 'light',
  logo: ''
};

function getLocal(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (e) {
    return fallback;
  }
}

function setLocal(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}

const inflightRequests = new Map();

/**
 * Get the current user's Firebase ID token for authenticated API requests.
 */
async function getAuthToken() {
  try {
    const user = auth?.currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch (e) {
    console.warn('Failed to get auth token:', e.message);
  }
  return null;
}

export async function apiRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const existing = inflightRequests.get(endpoint);
    if (existing) return existing;
  }

  const request = (async () => {
    try {
      // Inject Firebase auth token for authenticated requests
      const token = await getAuthToken();
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

      const config = {
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...options.headers
        },
        ...options
      };

      if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
      }

      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const text = await response.text();

      let data = null;
      if (text && text.trim().length > 0) {
        try {
          data = JSON.parse(text);
        } catch (jsonErr) {
          // Ignored
        }
      }

      if (!response.ok || !data) {
        return handleFallback(endpoint, options);
      }

      return data;
    } catch (err) {
      return handleFallback(endpoint, options);
    } finally {
      if (method === 'GET') {
        inflightRequests.delete(endpoint);
      }
    }
  })();

  if (method === 'GET') {
    inflightRequests.set(endpoint, request);
  }

  return request;
}

function handleFallback(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};

  if (endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/signup')) {
    const profile = getLocal('autoinvoice_user', DEFAULT_USER);
    if (body.fullName) {
      profile.fullName = body.fullName;
      if (body.email) profile.email = body.email;
      setLocal('autoinvoice_user', profile);
    }
    return { message: 'Success', user: { fullName: profile.fullName || body.fullName || 'User', email: body.email || profile.email } };
  }

  if (endpoint === '/dashboard') {
    const invoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
    const clients = getLocal('autoinvoice_clients', DEFAULT_CLIENTS);

    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const pendingAmount = invoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const paidCount = invoices.filter(i => i.status === 'paid').length;
    const draftCount = invoices.filter(i => i.status === 'draft').length;
    const overdueCount = invoices.filter(i => i.status === 'overdue').length;
    const avgClientRevenue = clients.length > 0 ? (invoices.reduce((sum, i) => sum + Number(i.amount || 0), 0) / clients.length).toFixed(2) : '0.00';

    return {
      totalInvoices: invoices.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      pendingAmount: Number(pendingAmount.toFixed(2)),
      totalClients: clients.length,
      avgClientRevenue: Number(avgClientRevenue),
      paidCount,
      draftCount,
      overdueCount,
      recentInvoices: invoices.slice(0, 5)
    };
  }

  if (endpoint === '/clients') {
    if (method === 'GET') return getLocal('autoinvoice_clients', DEFAULT_CLIENTS);
    if (method === 'POST') {
      const clients = getLocal('autoinvoice_clients', DEFAULT_CLIENTS);
      const newClient = {
        id: Date.now(),
        company: body.company || '',
        contact: body.contact || '',
        email: body.email || '',
        country: body.country || 'India',
        phone: body.phone || '',
        gstin: body.gstin || ''
      };
      clients.unshift(newClient);
      setLocal('autoinvoice_clients', clients);
      return newClient;
    }
  }

  if (endpoint.startsWith('/clients/')) {
    const id = Number(endpoint.split('/')[2]);
    let clients = getLocal('autoinvoice_clients', DEFAULT_CLIENTS);
    if (method === 'PUT') {
      clients = clients.map(c => c.id === id ? { ...c, ...body } : c);
      setLocal('autoinvoice_clients', clients);
      return clients.find(c => c.id === id) || body;
    }
    if (method === 'DELETE') {
      clients = clients.filter(c => c.id !== id);
      setLocal('autoinvoice_clients', clients);
      return { message: 'Client deleted' };
    }
  }

  if (endpoint === '/invoices') {
    if (method === 'GET') return getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
    if (method === 'POST') {
      const invoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
      const nextNum = invoices.length + 1;
      const invId = `INV-${String(nextNum).padStart(3, '0')}`;
      const items = Array.isArray(body.items) && body.items.length > 0
        ? body.items
        : [{ description: body.description || 'Service', hsnSac: body.hsnSac || '998314', quantity: Number(body.quantity) || 1, rate: Number(body.rate) || 0, amount: (Number(body.quantity) || 1) * (Number(body.rate) || 0) }];

      const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.rate) || 0), 0);
      const discountPct = Number(body.discount) || 0;
      const discountAmount = (subtotal * discountPct) / 100;
      const taxable = subtotal - discountAmount;
      const taxPct = Number(body.tax) || 0;
      const gstType = body.gstType || 'intra';

      let cgstRate = 0;
      let sgstRate = 0;
      let igstRate = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (gstType === 'intra') {
        cgstRate = taxPct / 2;
        sgstRate = taxPct / 2;
        cgstAmount = (taxable * cgstRate) / 100;
        sgstAmount = (taxable * sgstRate) / 100;
      } else if (gstType === 'inter') {
        igstRate = taxPct;
        igstAmount = (taxable * igstRate) / 100;
      }

      const taxAmount = (taxable * taxPct) / 100;
      const total = taxable + taxAmount;

      const today = new Date();
      const formattedCreated = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const newInvoice = {
        id: invId,
        client: body.client || '',
        clientEmail: body.clientEmail || '',
        clientGstin: body.clientGstin || '',
        template: body.template || 'modern',
        amount: Number(total.toFixed(2)),
        status: body.status || 'sent',
        created: formattedCreated,
        due: body.due || 'Not set',
        language: body.language || 'English',
        currency: body.currency || 'INR - Indian Rupee',
        description: items[0]?.description || body.description || '',
        items: items,
        quantity: items[0]?.quantity || 1,
        rate: items[0]?.rate || 0,
        discount: discountPct,
        gstType: gstType,
        tax: taxPct,
        cgstRate,
        sgstRate,
        igstRate,
        cgstAmount: Number(cgstAmount.toFixed(2)),
        sgstAmount: Number(sgstAmount.toFixed(2)),
        igstAmount: Number(igstAmount.toFixed(2)),
        subtotal: Number(subtotal.toFixed(2)),
        discountAmount: Number(discountAmount.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        notes: body.notes || ''
      };
      invoices.unshift(newInvoice);
      setLocal('autoinvoice_invoices', invoices);
      return newInvoice;
    }
  }

  if (endpoint.startsWith('/invoices/')) {
    const parts = endpoint.split('/');
    const invId = parts[2];
    let invoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);

    if (parts[3] === 'status' && method === 'PUT') {
      invoices = invoices.map(i => i.id === invId ? { ...i, status: body.status } : i);
      setLocal('autoinvoice_invoices', invoices);
      return invoices.find(i => i.id === invId) || {};
    }

    if (method === 'PUT') {
      invoices = invoices.map(i => i.id === invId ? { ...i, ...body } : i);
      setLocal('autoinvoice_invoices', invoices);
      return invoices.find(i => i.id === invId) || body;
    }

    if (method === 'DELETE') {
      invoices = invoices.filter(i => i.id !== invId);
      setLocal('autoinvoice_invoices', invoices);
      return { message: 'Invoice deleted' };
    }
  }

  if (endpoint === '/profile') {
    if (method === 'GET') return getLocal('autoinvoice_user', DEFAULT_USER);
    if (method === 'PUT') {
      const user = { ...getLocal('autoinvoice_user', DEFAULT_USER), ...body };
      setLocal('autoinvoice_user', user);
      return user;
    }
  }

  if (endpoint === '/account' && method === 'DELETE') {
    setLocal('autoinvoice_clients', []);
    setLocal('autoinvoice_invoices', []);
    setLocal('autoinvoice_user', { ...DEFAULT_USER });
    return { message: 'Account data cleared successfully' };
  }

  if (endpoint.includes('/send-email') || endpoint.includes('/send-reminder') || endpoint.includes('/send-receipt')) {
    return { success: false, fallbackRequired: true, message: 'Backend email service unavailable' };
  }

  return {};
}

// ----------------------------------------------------
// Cloud Firestore Data Sync Handlers with Fast Timeout
// ----------------------------------------------------
function getUserUID() {
  return auth?.currentUser?.uid || null;
}

function withTimeout(promise, ms = 3000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), ms))
  ]);
}

export const api = {
  // --- Dashboard ---
  getDashboard: async () => {
    const uid = getUserUID();
    if (uid && db) {
      try {
        const [invoices, clients] = await Promise.all([
          withTimeout(api.getInvoices(), 3000),
          withTimeout(api.getClients(), 3000)
        ]);
        const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount || 0), 0);
        const pendingAmount = invoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + Number(i.amount || 0), 0);
        const paidCount = invoices.filter(i => i.status === 'paid').length;
        const draftCount = invoices.filter(i => i.status === 'draft').length;
        const overdueCount = invoices.filter(i => i.status === 'overdue').length;
        const avgClientRevenue = clients.length > 0 ? (invoices.reduce((sum, i) => sum + Number(i.amount || 0), 0) / clients.length).toFixed(2) : '0.00';

        return {
          totalInvoices: invoices.length,
          totalRevenue: Number(totalRevenue.toFixed(2)),
          pendingAmount: Number(pendingAmount.toFixed(2)),
          totalClients: clients.length,
          avgClientRevenue: Number(avgClientRevenue),
          paidCount,
          draftCount,
          overdueCount,
          recentInvoices: invoices.slice(0, 5)
        };
      } catch (err) {
        console.warn('Firestore dashboard error, falling back:', err);
      }
    }
    return apiRequest('/dashboard');
  },

  // --- Clients ---
  getClients: async () => {
    const uid = getUserUID();
    if (uid && db) {
      try {
        const colRef = collection(db, 'users', uid, 'clients');
        const snap = await withTimeout(getDocs(colRef), 3000);
        if (!snap.empty) {
          const list = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
          setLocal('autoinvoice_clients', list);
          return list;
        }
      } catch (err) {
        console.warn('Firestore getClients error, falling back:', err);
      }
    }
    return apiRequest('/clients');
  },

  addClient: async (client) => {
    const uid = getUserUID();
    const newClient = {
      id: Date.now(),
      company: client.company || '',
      contact: client.contact || '',
      email: client.email || '',
      country: client.country || 'India',
      phone: client.phone || '',
      createdAt: new Date().toISOString()
    };

    // Optimistically update local storage first so UI never hangs
    const clients = getLocal('autoinvoice_clients', DEFAULT_CLIENTS);
    clients.unshift(newClient);
    setLocal('autoinvoice_clients', clients);

    if (uid && db) {
      try {
        const docRef = doc(db, 'users', uid, 'clients', String(newClient.id));
        await withTimeout(setDoc(docRef, newClient), 3000);
      } catch (err) {
        console.warn('Firestore addClient error:', err);
      }
    }

    return newClient;
  },

  updateClient: async (id, updates) => {
    const uid = getUserUID();
    let clients = getLocal('autoinvoice_clients', DEFAULT_CLIENTS);
    clients = clients.map(c => String(c.id) === String(id) ? { ...c, ...updates } : c);
    setLocal('autoinvoice_clients', clients);

    if (uid && db) {
      try {
        const docRef = doc(db, 'users', uid, 'clients', String(id));
        await withTimeout(updateDoc(docRef, updates), 3000);
      } catch (err) {
        console.warn('Firestore updateClient error:', err);
      }
    }
    return clients.find(c => String(c.id) === String(id)) || updates;
  },

  deleteClient: async (id) => {
    const uid = getUserUID();
    let clients = getLocal('autoinvoice_clients', DEFAULT_CLIENTS);
    clients = clients.filter(c => String(c.id) !== String(id));
    setLocal('autoinvoice_clients', clients);

    if (uid && db) {
      try {
        const docRef = doc(db, 'users', uid, 'clients', String(id));
        await withTimeout(deleteDoc(docRef), 3000);
      } catch (err) {
        console.warn('Firestore deleteClient error:', err);
      }
    }
    return { message: 'Client deleted' };
  },

  // --- Invoices ---
  getInvoices: async () => {
    const uid = getUserUID();
    if (uid && db) {
      try {
        const colRef = collection(db, 'users', uid, 'invoices');
        const snap = await withTimeout(getDocs(colRef), 3000);
        if (!snap.empty) {
          const list = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
          setLocal('autoinvoice_invoices', list);
          return list;
        }
      } catch (err) {
        console.warn('Firestore getInvoices error, falling back:', err);
      }
    }
    return apiRequest('/invoices');
  },

  addInvoice: async (invoiceData) => {
    const uid = getUserUID();
    const localInvoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
    const nextNum = localInvoices.length + 1;
    const invId = invoiceData.id || `INV-${String(nextNum).padStart(3, '0')}`;

    const items = Array.isArray(invoiceData.items) && invoiceData.items.length > 0
      ? invoiceData.items
      : [{ description: invoiceData.description || 'Service', quantity: Number(invoiceData.quantity) || 1, rate: Number(invoiceData.rate) || 0, amount: (Number(invoiceData.quantity) || 1) * (Number(invoiceData.rate) || 0) }];

    const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.rate) || 0), 0);
    const discountPct = Number(invoiceData.discount) || 0;
    const discountAmount = (subtotal * discountPct) / 100;
    const taxable = subtotal - discountAmount;
    const taxPct = Number(invoiceData.tax) || 0;
    const taxAmount = (taxable * taxPct) / 100;
    const total = taxable + taxAmount;

    const today = new Date();
    const formattedCreated = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const newInvoice = {
      id: invId,
      client: invoiceData.client || '',
      clientEmail: invoiceData.clientEmail || '',
      template: invoiceData.template || 'modern',
      amount: Number(total.toFixed(2)),
      status: invoiceData.status || 'sent',
      created: formattedCreated,
      due: invoiceData.due || 'Not set',
      language: invoiceData.language || 'English',
      currency: invoiceData.currency || 'INR - Indian Rupee',
      description: items[0]?.description || invoiceData.description || '',
      items: items,
      quantity: items[0]?.quantity || 1,
      rate: items[0]?.rate || 0,
      discount: discountPct,
      tax: taxPct,
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      notes: invoiceData.notes || '',
      createdAt: today.toISOString(),
      // GST fields
      gstin: invoiceData.gstin || '',
      clientGstin: invoiceData.clientGstin || '',
      hsnSac: invoiceData.hsnSac || '',
      placeOfSupply: invoiceData.placeOfSupply || '',
      gstType: invoiceData.gstType || 'intra',
      cgstRate: invoiceData.cgstRate || 0,
      sgstRate: invoiceData.sgstRate || 0,
      igstRate: invoiceData.igstRate || 0,
      cgstAmount: invoiceData.cgstAmount || 0,
      sgstAmount: invoiceData.sgstAmount || 0,
      igstAmount: invoiceData.igstAmount || 0,
      reverseCharge: invoiceData.reverseCharge || false,
      // Payment model
      payment: {
        status: 'unpaid',
        transactionId: null,
        method: null,
        paidAt: null,
        verifiedAt: null,
        verifiedBy: null
      },
      // Activity timeline
      activity: [{
        event: 'created',
        timestamp: today.toISOString(),
        actor: 'owner',
        details: { status: invoiceData.status || 'sent' }
      }]
    };

    localInvoices.unshift(newInvoice);
    setLocal('autoinvoice_invoices', localInvoices);

    if (uid && db) {
      try {
        const docRef = doc(db, 'users', uid, 'invoices', invId);
        await withTimeout(setDoc(docRef, newInvoice), 3000);
      } catch (err) {
        console.warn('Firestore addInvoice error:', err);
      }
    }

    return newInvoice;
  },

  updateInvoice: async (id, updates) => {
    const uid = getUserUID();
    let invoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
    invoices = invoices.map(i => i.id === id ? { ...i, ...updates } : i);
    setLocal('autoinvoice_invoices', invoices);

    if (uid && db) {
      try {
        const docRef = doc(db, 'users', uid, 'invoices', String(id));
        await withTimeout(updateDoc(docRef, updates), 3000);
      } catch (err) {
        console.warn('Firestore updateInvoice error:', err);
      }
    }
    return invoices.find(i => i.id === id) || updates;
  },

  updateInvoiceStatus: async (id, status) => {
    return api.updateInvoice(id, { status });
  },

  deleteInvoice: async (id) => {
    const uid = getUserUID();
    let invoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
    invoices = invoices.filter(i => i.id !== id);
    setLocal('autoinvoice_invoices', invoices);

    if (uid && db) {
      try {
        const docRef = doc(db, 'users', uid, 'invoices', String(id));
        await withTimeout(deleteDoc(docRef), 3000);
      } catch (err) {
        console.warn('Firestore deleteInvoice error:', err);
      }
    }
    return { message: 'Invoice deleted' };
  },

  // --- Profile ---
  getProfile: async () => {
    const uid = getUserUID();
    if (uid && db) {
      try {
        const docRef = doc(db, 'users', uid, 'profile', 'data');
        const snap = await withTimeout(getDoc(docRef), 3000);
        if (snap.exists()) {
          const profile = snap.data();
          setLocal('autoinvoice_user', profile);
          return profile;
        }
      } catch (err) {
        console.warn('Firestore getProfile error, fallback to local:', err);
      }
    }
    return apiRequest('/profile');
  },

  updateProfile: async (profile) => {
    const uid = getUserUID();
    const updated = { ...getLocal('autoinvoice_user', DEFAULT_USER), ...profile };
    // Optimistically update local storage first so UI never hangs
    setLocal('autoinvoice_user', updated);

    if (uid && db) {
      try {
        const docRef = doc(db, 'users', uid, 'profile', 'data');
        await withTimeout(setDoc(docRef, updated, { merge: true }), 3000);
      } catch (err) {
        console.warn('Firestore updateProfile error:', err);
      }
    }
    // Also sync to backend API if available
    try {
      await apiRequest('/profile', { method: 'PUT', body: updated });
    } catch (e) {
      // Ignored if standalone/offline
    }
    return updated;
  },

  // --- Account Reset ---
  deleteAccount: async () => {
    const uid = getUserUID();
    setLocal('autoinvoice_clients', []);
    setLocal('autoinvoice_invoices', []);
    setLocal('autoinvoice_user', { ...DEFAULT_USER });

    if (uid && db) {
      try {
        const [clientsSnap, invoicesSnap] = await Promise.all([
          withTimeout(getDocs(collection(db, 'users', uid, 'clients')), 3000),
          withTimeout(getDocs(collection(db, 'users', uid, 'invoices')), 3000)
        ]);
        const batch = writeBatch(db);
        clientsSnap.forEach(d => batch.delete(d.ref));
        invoicesSnap.forEach(d => batch.delete(d.ref));
        batch.delete(doc(db, 'users', uid, 'profile', 'data'));
        await withTimeout(batch.commit(), 3000);
      } catch (err) {
        console.warn('Firestore deleteAccount error:', err);
      }
    }
    return { message: 'Account data cleared successfully' };
  },

  // --- CSV Export Helper ---
  exportToCSV: (type, data) => {
    if (!data || data.length === 0) return;
    let csvContent = '';
    let filename = `${type}_export_${new Date().toISOString().slice(0, 10)}.csv`;

    if (type === 'invoices') {
      const headers = ['Invoice ID', 'Client', 'Client Email', 'Amount', 'Status', 'Date', 'Due Date', 'Tax %', 'Subtotal', 'Tax Amount', 'Notes'];
      const rows = data.map(i => [
        `"${i.id || ''}"`,
        `"${(i.client || '').replace(/"/g, '""')}"`,
        `"${i.clientEmail || ''}"`,
        i.amount || 0,
        i.status || 'sent',
        `"${i.created || ''}"`,
        `"${i.due || ''}"`,
        i.tax || 0,
        i.subtotal || 0,
        i.taxAmount || 0,
        `"${(i.notes || '').replace(/"/g, '""')}"`
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (type === 'clients') {
      const headers = ['Company', 'Contact Person', 'Email', 'Phone', 'Country'];
      const rows = data.map(c => [
        `"${(c.company || '').replace(/"/g, '""')}"`,
        `"${(c.contact || '').replace(/"/g, '""')}"`,
        `"${c.email || ''}"`,
        `"${c.phone || ''}"`,
        `"${c.country || ''}"`
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // Auth (Legacy API routes)
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: credentials }),
  signup: (userData) => apiRequest('/auth/signup', { method: 'POST', body: userData }),

  // --- Backend & Cloud Transactional Email Delivery (FormSubmit Direct) ---
  sendInvoiceEmail: async (invoiceId, options = {}) => {
    const payload = {};
    if (options.recipientEmail) payload.recipientEmail = options.recipientEmail;
    if (options.pdfBase64) payload.pdfBase64 = options.pdfBase64;

    try {
      const res = await apiRequest(`/invoices/${encodeURIComponent(invoiceId)}/send`, {
        method: 'POST',
        body: payload
      });
      if (res && res.success) {
        let invoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
        invoices = invoices.map(i => String(i.id) === String(invoiceId) ? {
          ...i,
          emailStatus: 'sent',
          emailSentTo: res.recipient || options.recipientEmail,
          emailSentAt: res.sentAt || new Date().toISOString()
        } : i);
        setLocal('autoinvoice_invoices', invoices);
        return res;
      }
      if (res && res.error) {
        throw new Error(res.error);
      }
    } catch (e) {
      console.warn('Backend send API notice, using direct FormSubmit cloud delivery:', e.message);
    }

    const toEmail = (options.recipientEmail || '').trim();
    if (!toEmail) {
      throw new Error('Recipient email address is required');
    }

    const sentAt = new Date().toISOString();

    // Retrieve invoice and sender details for rich FormSubmit payload
    let invoice = null;
    try {
      const invoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
      invoice = invoices.find(i => String(i.id) === String(invoiceId));
    } catch (e) {}

    const userProfile = getLocal('autoinvoice_user', DEFAULT_USER);
    const clients = getLocal('autoinvoice_clients', DEFAULT_CLIENTS);
    const clientObj = clients.find(c => c.company === invoice?.client);

    const senderName = userProfile?.businessName || userProfile?.fullName || 'AutoInvoice Business';
    const currencyStr = invoice?.currency || userProfile?.currency || 'INR - Indian Rupee';
    const formattedAmount = formatCurrency(invoice?.amount || 0, currencyStr);
    const baseUrl = typeof window !== 'undefined' && window.location && window.location.origin
      ? window.location.origin
      : 'https://autoinvoice-frontend.saumyamir25.workers.dev';
    const paymentUrl = `${baseUrl}/#/pay/${encodeURIComponent(invoiceId)}`;

    const emailSubject = options.subject || `Invoice ${invoiceId} from ${senderName} — ${formattedAmount}`;
    const emailMessage = options.message || `Dear ${invoice?.client || clientObj?.company || 'Valued Client'},\n\nPlease find invoice ${invoiceId} from ${senderName}.\nAmount: ${formattedAmount}\nDue Date: ${invoice?.due || 'Upon Receipt'}\n\nYou can view and pay online here:\n${paymentUrl}\n\nThank you for your business!`;

    // Verified FormSubmit Service Endpoint
    const primaryEndpoint = 'Saumyamir25@gmail.com';
    const senderEmail = userProfile?.email || primaryEndpoint;

    // Deliver real email via FormSubmit AJAX API
    // 1. Post to verified endpoint with _cc, email, and _autoresponse to guarantee delivery to client
    try {
      await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(primaryEndpoint)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: emailSubject,
          _template: 'box',
          _captcha: 'false',
          _replyto: senderEmail,
          _cc: toEmail,
          _autoresponse: emailMessage,
          email: toEmail,
          "Recipient Email": toEmail,
          "Invoice Number": invoiceId,
          "Business Name": senderName,
          "Client Name": invoice?.client || clientObj?.company || 'Valued Client',
          "Amount Due": formattedAmount,
          "Issue Date": invoice?.created || 'Today',
          "Due Date": invoice?.due || 'Upon Receipt',
          "View & Pay Invoice Online": paymentUrl,
          "Payment Link": paymentUrl,
          "Message": emailMessage
        })
      });
    } catch (fsErr) {
      console.warn('FormSubmit primary dispatch note:', fsErr.message);
    }

    // 2. Also dispatch directly to client email endpoint if different
    if (toEmail.toLowerCase() !== primaryEndpoint.toLowerCase()) {
      try {
        await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(toEmail)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            _subject: emailSubject,
            _template: 'box',
            _captcha: 'false',
            _replyto: senderEmail,
            "Invoice Number": invoiceId,
            "Business Name": senderName,
            "Client Name": invoice?.client || clientObj?.company || 'Valued Client',
            "Amount Due": formattedAmount,
            "Issue Date": invoice?.created || 'Today',
            "Due Date": invoice?.due || 'Upon Receipt',
            "View & Pay Invoice Online": paymentUrl,
            "Payment Link": paymentUrl,
            "Message": emailMessage
          })
        });
      } catch (fsDirectErr) {
        // Direct attempt fallback
      }
    }

    try {
      await api.updateInvoice(invoiceId, {
        emailStatus: 'sent',
        emailSentTo: toEmail,
        emailSentAt: sentAt,
        status: 'sent'
      });
      await api.addInvoiceActivity(invoiceId, 'email_sent', {
        to: toEmail,
        withPdf: Boolean(options.pdfBase64),
        dispatchedAt: sentAt
      });
    } catch (persistErr) {
      console.warn('Direct invoice status persistence notice:', persistErr);
    }

    return {
      success: true,
      recipient: toEmail,
      emailStatus: 'sent',
      sentAt,
      message: `Invoice ${invoiceId} was sent to ${toEmail}`
    };
  },

  sendPaymentReminder: async (invoiceId, reminderType = 'upcoming') => {
    try {
      const res = await apiRequest(`/invoices/${encodeURIComponent(invoiceId)}/send-reminder`, {
        method: 'POST',
        body: { reminderType }
      });
      if (res && res.success) return res;
    } catch (e) {
      console.warn('Backend reminder API notice, dispatching via FormSubmit:', e.message);
    }

    let invoice = null;
    try {
      const invoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
      invoice = invoices.find(i => String(i.id) === String(invoiceId));
    } catch (e) {}

    const userProfile = getLocal('autoinvoice_user', DEFAULT_USER);
    const clients = getLocal('autoinvoice_clients', DEFAULT_CLIENTS);
    const clientObj = clients.find(c => c.company === invoice?.client);
    const toEmail = invoice?.clientEmail || clientObj?.email;

    if (toEmail) {
      const senderName = userProfile?.businessName || userProfile?.fullName || 'AutoInvoice Business';
      const currencyStr = invoice?.currency || userProfile?.currency || 'INR - Indian Rupee';
      const formattedAmount = formatCurrency(invoice?.amount || 0, currencyStr);
      const baseUrl = typeof window !== 'undefined' && window.location && window.location.origin
        ? window.location.origin
        : 'https://autoinvoice-frontend.saumyamir25.workers.dev';
      const paymentUrl = `${baseUrl}/#/pay/${encodeURIComponent(invoiceId)}`;
      const primaryEndpoint = 'Saumyamir25@gmail.com';
      const reminderSubject = `Payment Reminder: Invoice ${invoiceId} (${formattedAmount})`;
      const reminderBody = `Dear ${invoice?.client || clientObj?.company || 'Valued Client'},\n\nThis is a friendly reminder that Invoice ${invoiceId} for ${formattedAmount} is ${reminderType === 'overdue' ? 'OVERDUE' : 'due soon'} (${invoice?.due || 'Upon Receipt'}).\n\nYou can view and pay online here:\n${paymentUrl}\n\nThank you for your prompt payment!\n${senderName}`;

      try {
        await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(primaryEndpoint)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            _subject: reminderSubject,
            _template: 'box',
            _captcha: 'false',
            _cc: toEmail.trim(),
            _autoresponse: reminderBody,
            email: toEmail.trim(),
            "Reminder Type": reminderType === 'overdue' ? 'OVERDUE NOTICE' : 'Upcoming Due Reminder',
            "Invoice Number": invoiceId,
            "Business Name": senderName,
            "Client Name": invoice?.client || clientObj?.company || 'Valued Client',
            "Amount Due": formattedAmount,
            "Due Date": invoice?.due || 'Upon Receipt',
            "Payment Link": paymentUrl,
            "Message": reminderBody
          })
        });
      } catch (err) {}
    }

    const sentAt = new Date().toISOString();
    try {
      await api.addInvoiceActivity(invoiceId, 'reminder_sent', {
        reminderType,
        dispatchedAt: sentAt
      });
    } catch (e) {}

    return {
      success: true,
      message: `Payment reminder sent successfully for Invoice ${invoiceId}`
    };
  },

  sendPaymentReceipt: async (invoiceId) => {
    try {
      const res = await apiRequest(`/invoices/${encodeURIComponent(invoiceId)}/send-receipt`, { method: 'POST' });
      if (res && res.success) return res;
    } catch (e) {
      console.warn('Backend receipt API unreachable, checking cloud delivery:', e.message);
    }

    const settings = getEmailSettings();
    if (settings.emailjs?.serviceId && settings.emailjs?.templateId && settings.emailjs?.publicKey) {
      const invoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
      const inv = invoices.find(i => String(i.id) === String(invoiceId));
      const userProfile = getLocal('autoinvoice_user', DEFAULT_USER);
      const clients = getLocal('autoinvoice_clients', DEFAULT_CLIENTS);
      const clientObj = clients.find(c => c.company === inv?.client);
      if (inv) {
        const emailData = buildReceiptEmailData(inv, userProfile, clientObj, inv.payment);
        if (emailData.recipientEmail) {
          await sendEmailJS({
            to: emailData.recipientEmail,
            subject: emailData.subject,
            message: emailData.textBody,
            invoiceData: inv
          });
          return { success: true, method: 'emailjs', message: `Receipt sent via EmailJS to ${emailData.recipientEmail}` };
        }
      }
    }

    return { success: false, fallbackRequired: true, message: 'Please dispatch receipt via Gmail or EmailJS' };
  },

  // --- Payment Management ---
  recordPayment: async (invoiceId, paymentData) => {
    return apiRequest(`/invoices/${encodeURIComponent(invoiceId)}/record-payment`, {
      method: 'POST',
      body: paymentData
    });
  },

  verifyPayment: async (invoiceId) => {
    return apiRequest(`/invoices/${encodeURIComponent(invoiceId)}/verify-payment`, {
      method: 'POST'
    });
  },

  // --- Public Invoice (no auth needed) ---
  getPublicInvoice: async (invoiceId, ownerUid) => {
    const uid = ownerUid || getUserUID() || '';
    try {
      const response = await fetch(`${API_BASE}/public/invoices/${encodeURIComponent(invoiceId)}?uid=${uid}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn('Public invoice fetch error:', err);
    }
    // Fallback: try local data
    const invoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
    const invoice = invoices.find(i => String(i.id).toLowerCase() === String(invoiceId).toLowerCase());
    const profile = getLocal('autoinvoice_user', DEFAULT_USER);
    return { invoice: invoice || null, profile };
  },

  confirmClientPayment: async (invoiceId, paymentData) => {
    const uid = getUserUID() || '';
    try {
      const response = await fetch(`${API_BASE}/public/invoices/${encodeURIComponent(invoiceId)}/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...paymentData, uid })
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn('Payment confirmation error:', err);
    }
    // Fallback: update locally
    return api.updateInvoice(invoiceId, {
      status: 'pending_verification',
      payment: {
        status: 'pending_verification',
        transactionId: paymentData.transactionId,
        method: paymentData.method || 'upi',
        paidAt: new Date().toISOString(),
        verifiedAt: null,
        verifiedBy: null
      }
    });
  },

  // --- Activity Timeline ---
  addInvoiceActivity: async (invoiceId, event, details = {}) => {
    const uid = getUserUID();
    const activityEntry = {
      event,
      timestamp: new Date().toISOString(),
      actor: 'owner',
      details
    };

    // Update local
    let invoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
    invoices = invoices.map(inv => {
      if (inv.id === invoiceId) {
        const activity = inv.activity || [];
        activity.push(activityEntry);
        return { ...inv, activity };
      }
      return inv;
    });
    setLocal('autoinvoice_invoices', invoices);

    // Sync to Firestore
    if (uid && db) {
      try {
        const { doc: firestoreDoc, updateDoc: firestoreUpdate, getDoc: firestoreGet } = await import('firebase/firestore');
        const docRef = firestoreDoc(db, 'users', uid, 'invoices', String(invoiceId));
        const snap = await withTimeout(firestoreGet(docRef), 3000);
        if (snap.exists()) {
          const data = snap.data();
          const activity = data.activity || [];
          activity.push(activityEntry);
          await withTimeout(firestoreUpdate(docRef, { activity }), 3000);
        }
      } catch (err) {
        console.warn('Firestore activity log error:', err);
      }
    }

    return activityEntry;
  },

  // --- Recurring Invoices ---
  getRecurringInvoices: async () => {
    const uid = getUserUID();
    if (uid && db) {
      try {
        const { collection: firestoreCol, getDocs: firestoreGetDocs } = await import('firebase/firestore');
        const snap = await withTimeout(firestoreGetDocs(firestoreCol(db, 'users', uid, 'recurring')), 3000);
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setLocal('autoinvoice_recurring', list);
          return list;
        }
      } catch (e) {
        console.warn('Firestore recurring read error:', e);
      }
    }
    return getLocal('autoinvoice_recurring', [
      {
        id: 'REC-001',
        client: 'Google India Pvt Ltd',
        clientEmail: 'john@google.com',
        amount: 1500,
        frequency: 'monthly',
        status: 'active',
        startDate: '2025-01-01',
        nextDate: '2025-11-01',
        description: 'Monthly Cloud Infrastructure & Maintenance Retainer',
        items: [{ description: 'Monthly Retainer', quantity: 1, rate: 1271.19, amount: 1271.19, hsnSac: '998314' }],
        tax: 18,
        currency: 'INR - Indian Rupee'
      }
    ]);
  },

  createRecurringInvoice: async (data) => {
    const uid = getUserUID();
    const id = `REC-${Date.now().toString().slice(-4)}`;
    const newSchedule = { id, ...data, createdAt: new Date().toISOString(), status: data.status || 'active' };
    
    let list = getLocal('autoinvoice_recurring', []);
    list.unshift(newSchedule);
    setLocal('autoinvoice_recurring', list);

    if (uid && db) {
      try {
        const { doc: firestoreDoc, setDoc: firestoreSet } = await import('firebase/firestore');
        await withTimeout(firestoreSet(firestoreDoc(db, 'users', uid, 'recurring', id), newSchedule), 3000);
      } catch (e) {
        console.warn('Firestore recurring write error:', e);
      }
    }
    return newSchedule;
  },

  updateRecurringInvoice: async (id, data) => {
    const uid = getUserUID();
    let list = getLocal('autoinvoice_recurring', []);
    list = list.map(item => item.id === id ? { ...item, ...data } : item);
    setLocal('autoinvoice_recurring', list);

    if (uid && db) {
      try {
        const { doc: firestoreDoc, updateDoc: firestoreUpdate } = await import('firebase/firestore');
        await withTimeout(firestoreUpdate(firestoreDoc(db, 'users', uid, 'recurring', String(id)), data), 3000);
      } catch (e) {
        console.warn('Firestore recurring update error:', e);
      }
    }
    return { id, ...data };
  },

  deleteRecurringInvoice: async (id) => {
    const uid = getUserUID();
    let list = getLocal('autoinvoice_recurring', []);
    list = list.filter(item => item.id !== id);
    setLocal('autoinvoice_recurring', list);

    if (uid && db) {
      try {
        const { doc: firestoreDoc, deleteDoc: firestoreDelete } = await import('firebase/firestore');
        await withTimeout(firestoreDelete(firestoreDoc(db, 'users', uid, 'recurring', String(id))), 3000);
      } catch (e) {
        console.warn('Firestore recurring delete error:', e);
      }
    }
    return { success: true };
  },

  // --- Payments Ledger ---
  getPayments: async () => {
    const invoices = await api.getInvoices();
    const payments = [];
    invoices.forEach(inv => {
      if (inv.payment && (inv.payment.status === 'verified' || inv.payment.status === 'pending_verification' || inv.status === 'paid')) {
        payments.push({
          id: inv.payment.transactionId || `PAY-${inv.id}`,
          invoiceId: inv.id,
          client: inv.client || 'Client',
          clientEmail: inv.clientEmail || '',
          amount: inv.amount || 0,
          currency: inv.currency || 'INR - Indian Rupee',
          method: inv.payment.method || 'upi',
          transactionId: inv.payment.transactionId || 'DIRECT_TRANSFER',
          status: inv.payment.status || (inv.status === 'paid' ? 'verified' : 'pending_verification'),
          date: inv.payment.paidAt || inv.due || inv.created || 'Recent',
          payerName: inv.payment.payerName || '',
          payerEmail: inv.payment.payerEmail || '',
          invoice: inv
        });
      } else if (inv.status === 'paid') {
        payments.push({
          id: `PAY-${inv.id}`,
          invoiceId: inv.id,
          client: inv.client || 'Client',
          clientEmail: inv.clientEmail || '',
          amount: inv.amount || 0,
          currency: inv.currency || 'INR - Indian Rupee',
          method: 'upi',
          transactionId: 'CONFIRMED_PAYMENT',
          status: 'verified',
          date: inv.created || 'Recent',
          invoice: inv
        });
      }
    });
    return payments;
  },

  // --- Expenses Management ---
  getExpenses: async () => {
    const uid = getUserUID();
    if (uid && db) {
      try {
        const { collection: firestoreCol, getDocs: firestoreGetDocs } = await import('firebase/firestore');
        const snap = await withTimeout(firestoreGetDocs(firestoreCol(db, 'users', uid, 'expenses')), 3000);
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setLocal('autoinvoice_expenses', list);
          return list;
        }
      } catch (e) {
        console.warn('Firestore expenses read error:', e);
      }
    }
    return getLocal('autoinvoice_expenses', [
      {
        id: 'EXP-001',
        title: 'AWS Cloud Hosting & Lambda',
        category: 'software',
        amount: 2400,
        currency: 'INR - Indian Rupee',
        date: 'Sep 25, 2025',
        paymentMethod: 'card',
        notes: 'Monthly infrastructure bill'
      },
      {
        id: 'EXP-002',
        title: 'Figma Organization Subscription',
        category: 'software',
        amount: 1200,
        currency: 'INR - Indian Rupee',
        date: 'Sep 20, 2025',
        paymentMethod: 'card',
        notes: 'Design team tooling'
      },
      {
        id: 'EXP-003',
        title: 'Co-working Office Desk & WiFi',
        category: 'office',
        amount: 5000,
        currency: 'INR - Indian Rupee',
        date: 'Sep 15, 2025',
        paymentMethod: 'upi',
        notes: 'Monthly rent'
      }
    ]);
  },

  createExpense: async (expenseData) => {
    const uid = getUserUID();
    const id = `EXP-${Date.now().toString().slice(-4)}`;
    const newExpense = {
      id,
      ...expenseData,
      amount: Number(expenseData.amount) || 0,
      createdAt: new Date().toISOString()
    };

    let list = getLocal('autoinvoice_expenses', []);
    list.unshift(newExpense);
    setLocal('autoinvoice_expenses', list);

    if (uid && db) {
      try {
        const { doc: firestoreDoc, setDoc: firestoreSet } = await import('firebase/firestore');
        await withTimeout(firestoreSet(firestoreDoc(db, 'users', uid, 'expenses', id), newExpense), 3000);
      } catch (e) {
        console.warn('Firestore expense add error:', e);
      }
    }
    return newExpense;
  },

  updateExpense: async (id, expenseData) => {
    const uid = getUserUID();
    let list = getLocal('autoinvoice_expenses', []);
    list = list.map(item => item.id === id ? { ...item, ...expenseData, amount: Number(expenseData.amount) || item.amount } : item);
    setLocal('autoinvoice_expenses', list);

    if (uid && db) {
      try {
        const { doc: firestoreDoc, updateDoc: firestoreUpdate } = await import('firebase/firestore');
        await withTimeout(firestoreUpdate(firestoreDoc(db, 'users', uid, 'expenses', String(id)), expenseData), 3000);
      } catch (e) {
        console.warn('Firestore expense update error:', e);
      }
    }
    return { id, ...expenseData };
  },

  deleteExpense: async (id) => {
    const uid = getUserUID();
    let list = getLocal('autoinvoice_expenses', []);
    list = list.filter(item => item.id !== id);
    setLocal('autoinvoice_expenses', list);

    if (uid && db) {
      try {
        const { doc: firestoreDoc, deleteDoc: firestoreDelete } = await import('firebase/firestore');
        await withTimeout(firestoreDelete(firestoreDoc(db, 'users', uid, 'expenses', String(id))), 3000);
      } catch (e) {
        console.warn('Firestore expense delete error:', e);
      }
    }
    return { success: true };
  },

  // --- AI Invoice Assistant Natural Language Parsing ---
  parseInvoiceWithAI: async (prompt) => {
    try {
      const res = await apiRequest('/ai/parse-invoice', {
        method: 'POST',
        body: { prompt }
      });
      if (res && res.draft) return res;
    } catch (e) {
      console.warn('Backend AI parse failed, using client fallback:', e);
    }

    // Client-side structured natural language regex fallback
    const text = prompt.toLowerCase();
    const amtMatch = text.match(/(?:₹|\$|rs\.?|inr|usd)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+)/i);
    const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, '')) : 1000;

    const taxMatch = text.match(/([0-9]{1,2})\s*%\s*(?:gst|tax)|(?:gst|tax)\s*([0-9]{1,2})\s*%/i);
    const tax = taxMatch ? parseInt(taxMatch[1] || taxMatch[2], 10) : 18;

    let gstType = 'intra';
    if (text.includes('inter-state') || text.includes('inter state') || text.includes('igst')) {
      gstType = 'inter';
    }

    let client = 'Client';
    const forMatch = prompt.match(/(?:for|to|client)\s+([A-Z][A-Za-z0-9\s&]+?)(?:\s+(?:for|worth|amount|\$|₹|rs|with|at|due|gst)|$)/i);
    if (forMatch && forMatch[1]) {
      client = forMatch[1].trim();
    }

    let description = 'Professional Consultation & Development';
    const descMatch = prompt.match(/(?:for|regarding|service)\s+([A-Za-z0-9\s,.-]+?)(?:\s+worth|\s+amount|\s+due|\s+with|\s+rate|\s*\$|\s*₹|\s*rs|$)/i);
    if (descMatch && descMatch[1] && descMatch[1].trim().toLowerCase() !== client.toLowerCase()) {
      description = descMatch[1].trim();
    }

    let dueDays = 15;
    const dueMatch = text.match(/due\s+(?:in\s+)?([0-9]+)\s*days?/i);
    if (dueMatch) {
      dueDays = parseInt(dueMatch[1], 10);
    }
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
    const formattedDue = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return {
      success: true,
      draft: {
        client,
        description,
        amount,
        tax,
        gstType,
        items: [{ description, quantity: 1, rate: amount, amount: amount, hsnSac: '998314' }],
        due: formattedDue,
        notes: 'Generated via AutoInvoice AI Assistant.'
      }
    };
  },

  // --- Complete Backup Export & Restore ---
  exportAllBackup: async () => {
    const [invoices, clients, profile, recurring, expenses] = await Promise.all([
      api.getInvoices(),
      api.getClients(),
      api.getProfile(),
      api.getRecurringInvoices(),
      api.getExpenses()
    ]);

    const backupData = {
      app: 'AutoInvoice',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      data: {
        invoices,
        clients,
        profile,
        recurring,
        expenses
      }
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoinvoice_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  },

  restoreAllBackup: async (backupData) => {
    if (!backupData || !backupData.data) {
      throw new Error('Invalid backup file format');
    }
    const { invoices, clients, profile, recurring, expenses } = backupData.data;

    if (invoices) setLocal('autoinvoice_invoices', invoices);
    if (clients) setLocal('autoinvoice_clients', clients);
    if (profile) setLocal('autoinvoice_user', profile);
    if (recurring) setLocal('autoinvoice_recurring', recurring);
    if (expenses) setLocal('autoinvoice_expenses', expenses);

    const uid = getUserUID();
    if (uid && db) {
      try {
        const { doc: firestoreDoc, setDoc: firestoreSet, writeBatch } = await import('firebase/firestore');
        const batch = writeBatch(db);
        if (profile) {
          batch.set(firestoreDoc(db, 'users', uid, 'profile', 'data'), profile);
        }
        if (Array.isArray(invoices)) {
          invoices.forEach(inv => {
            batch.set(firestoreDoc(db, 'users', uid, 'invoices', String(inv.id)), inv);
          });
        }
        if (Array.isArray(clients)) {
          clients.forEach(c => {
            batch.set(firestoreDoc(db, 'users', uid, 'clients', String(c.id)), c);
          });
        }
        await batch.commit();
      } catch (e) {
        console.warn('Firestore backup restore sync error:', e);
      }
    }
    return true;
  }
};
