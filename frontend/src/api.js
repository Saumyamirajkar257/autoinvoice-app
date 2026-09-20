const API_BASE = '/api';

// Default initial data for local storage fallback
const DEFAULT_CLIENTS = [
  { id: 1, company: 'Google', contact: 'John', email: 'zzaidd2003@gmail.com', country: 'United States', phone: '9999999999' }
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
    items: [{ description: 'Mobile App Design', quantity: 1, rate: 1271.19, amount: 1271.19 }],
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
    items: [{ description: 'Website Development', quantity: 1, rate: 600, amount: 600 }],
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

function handleFallback(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};

  // Auth Fallback
  if (endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/signup')) {
    const profile = getLocal('autoinvoice_user', DEFAULT_USER);
    if (body.fullName) {
      profile.fullName = body.fullName;
      if (body.email) profile.email = body.email;
      setLocal('autoinvoice_user', profile);
    }
    return { message: 'Success', user: { fullName: profile.fullName || body.fullName || 'User', email: body.email || profile.email } };
  }

  // Dashboard Stats Fallback
  if (endpoint === '/dashboard') {
    const invoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
    const clients = getLocal('autoinvoice_clients', DEFAULT_CLIENTS);

    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const pendingAmount = invoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const paidCount = invoices.filter(i => i.status === 'paid').length;
    const draftCount = invoices.filter(i => i.status === 'draft').length;
    const avgClientRevenue = clients.length > 0 ? (invoices.reduce((sum, i) => sum + Number(i.amount || 0), 0) / clients.length).toFixed(2) : '0.00';

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
  }

  // Clients API Fallback
  if (endpoint === '/clients') {
    if (method === 'GET') return getLocal('autoinvoice_clients', DEFAULT_CLIENTS);
    if (method === 'POST') {
      const clients = getLocal('autoinvoice_clients', DEFAULT_CLIENTS);
      const newClient = { id: Date.now(), company: body.company || '', contact: body.contact || '', email: body.email || '', country: body.country || 'India', phone: body.phone || '' };
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

  // Invoices API Fallback
  if (endpoint === '/invoices') {
    if (method === 'GET') return getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
    if (method === 'POST') {
      const invoices = getLocal('autoinvoice_invoices', DEFAULT_INVOICES);
      const nextNum = invoices.length + 1;
      const invId = `INV-${String(nextNum).padStart(3, '0')}`;
      const items = Array.isArray(body.items) && body.items.length > 0 ? body.items : [{ description: body.description || 'Service', quantity: Number(body.quantity) || 1, rate: Number(body.rate) || 0, amount: (Number(body.quantity) || 1) * (Number(body.rate) || 0) }];

      const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.rate) || 0), 0);
      const discountPct = Number(body.discount) || 0;
      const discountAmount = (subtotal * discountPct) / 100;
      const taxable = subtotal - discountAmount;
      const taxPct = Number(body.tax) || 0;
      const taxAmount = (taxable * taxPct) / 100;
      const total = taxable + taxAmount;

      const today = new Date();
      const formattedCreated = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const newInvoice = {
        id: invId,
        client: body.client || '',
        clientEmail: body.clientEmail || '',
        amount: Number(total.toFixed(2)),
        status: body.status || 'sent',
        created: formattedCreated,
        due: body.due || 'Not set',
        description: items[0]?.description || body.description || '',
        items: items,
        quantity: items[0]?.quantity || 1,
        rate: items[0]?.rate || 0,
        discount: discountPct,
        tax: taxPct,
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

  // Profile API Fallback
  if (endpoint === '/profile') {
    if (method === 'GET') return getLocal('autoinvoice_user', DEFAULT_USER);
    if (method === 'PUT') {
      const user = { ...getLocal('autoinvoice_user', DEFAULT_USER), ...body };
      setLocal('autoinvoice_user', user);
      return user;
    }
  }

  // Account Reset Fallback
  if (endpoint === '/account' && method === 'DELETE') {
    setLocal('autoinvoice_clients', []);
    setLocal('autoinvoice_invoices', []);
    setLocal('autoinvoice_user', { ...DEFAULT_USER, fullName: '', businessName: '', address: '', phone: '', website: '', taxId: '', logo: '' });
    return { message: 'Account data cleared successfully' };
  }

  return {};
}

export async function apiRequest(endpoint, options = {}) {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
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
  }
}

// API methods
export const api = {
  // Auth
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: credentials }),
  signup: (userData) => apiRequest('/auth/signup', { method: 'POST', body: userData }),

  // Dashboard
  getDashboard: () => apiRequest('/dashboard'),

  // Clients
  getClients: () => apiRequest('/clients'),
  addClient: (client) => apiRequest('/clients', { method: 'POST', body: client }),
  updateClient: (id, client) => apiRequest(`/clients/${id}`, { method: 'PUT', body: client }),
  deleteClient: (id) => apiRequest(`/clients/${id}`, { method: 'DELETE' }),

  // Invoices
  getInvoices: () => apiRequest('/invoices'),
  addInvoice: (invoice) => apiRequest('/invoices', { method: 'POST', body: invoice }),
  updateInvoice: (id, invoice) => apiRequest(`/invoices/${id}`, { method: 'PUT', body: invoice }),
  updateInvoiceStatus: (id, status) => apiRequest(`/invoices/${id}/status`, { method: 'PUT', body: { status } }),
  deleteInvoice: (id) => apiRequest(`/invoices/${id}`, { method: 'DELETE' }),

  // Profile
  getProfile: () => apiRequest('/profile'),
  updateProfile: (profile) => apiRequest('/profile', { method: 'PUT', body: profile }),

  // Account
  deleteAccount: () => apiRequest('/account', { method: 'DELETE' })
};
