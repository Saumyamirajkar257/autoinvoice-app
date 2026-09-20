import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { api } from '../api';

export default function Clients({ clients, onRefresh, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  // Form state
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('United States');
  const [phone, setPhone] = useState('');

  const openAddModal = () => {
    setEditingClient(null);
    setCompany('');
    setContact('');
    setEmail('');
    setCountry('United States');
    setPhone('');
    setModalOpen(true);
  };

  const openEditModal = (c) => {
    setEditingClient(c);
    setCompany(c.company || '');
    setContact(c.contact || '');
    setEmail(c.email || '');
    setCountry(c.country || 'United States');
    setPhone(c.phone || '');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingClient(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!company.trim()) {
      showToast('Company name is required', 'error');
      return;
    }

    try {
      if (editingClient) {
        await api.updateClient(editingClient.id, {
          company,
          contact,
          email,
          country,
          phone
        });
        showToast('Client updated successfully', 'success');
      } else {
        await api.addClient({
          company,
          contact,
          email,
          country,
          phone
        });
        showToast('Client added successfully', 'success');
      }
      closeModal();
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Error saving client', 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete client "${name}"?`)) {
      return;
    }
    try {
      await api.deleteClient(id);
      showToast('Client deleted successfully', 'success');
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Error deleting client', 'error');
    }
  };

  const filteredClients = clients.filter(c => {
    const q = searchTerm.toLowerCase();
    return (
      (c.company || '').toLowerCase().includes(q) ||
      (c.contact || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.country || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="content-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage your client relationships and contact information.</p>
        </div>
        <button className="btn-primary" onClick={openAddModal}>
          <Plus size={16} />
          Add New Client
        </button>
      </div>

      {/* Search Bar Card */}
      <div className="search-card">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search clients by name, company, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-primary" style={{ padding: '10px 20px' }}>
          Search
        </button>
      </div>

      {/* Clients Table Card */}
      <div className="table-container">
        <div className="table-header-title">
          All Clients ({filteredClients.length})
        </div>
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Country</th>
              <th>Phone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '32px' }}>
                  No clients found.
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => (
                <tr key={client.id}>
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>{client.company}</td>
                  <td>{client.contact || '-'}</td>
                  <td>
                    <span style={{ color: '#2563eb' }}>{client.email || '-'}</span>
                  </td>
                  <td>{client.country || '-'}</td>
                  <td>{client.phone || '-'}</td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="icon-action-btn"
                        title="Edit Client"
                        onClick={() => openEditModal(client)}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        className="icon-action-btn delete"
                        title="Delete Client"
                        onClick={() => handleDelete(client.id, client.company)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Client Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingClient ? 'Edit Client' : 'Add New Client'}</h3>
              <button className="modal-close" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">
                    Company Name <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Google"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. John Doe"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="e.g. john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Country</label>
                    <select
                      className="form-select"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    >
                      <option value="United States">United States</option>
                      <option value="India">India</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="Germany">Germany</option>
                      <option value="Singapore">Singapore</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 9999999999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingClient ? 'Update Client' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
