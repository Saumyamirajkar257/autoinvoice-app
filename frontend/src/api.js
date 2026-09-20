const API_BASE = '/api';

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
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
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
