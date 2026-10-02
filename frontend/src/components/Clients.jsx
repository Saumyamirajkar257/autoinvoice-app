import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, X, FileSpreadsheet, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { api } from '../api';

export default function Clients({ clients = [], onRefresh, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [saving, setSaving] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form state
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('India');
  const [phone, setPhone] = useState('');

  const openAddModal = () => {
    setEditingClient(null);
    setCompany('');
    setContact('');
    setEmail('');
    setCountry('India');
    setPhone('');
    setModalOpen(true);
  };

  const openEditModal = (c) => {
    setEditingClient(c);
    setCompany(c.company || '');
    setContact(c.contact || '');
    setEmail(c.email || '');
    setCountry(c.country || 'India');
    setPhone(c.phone || '');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingClient(null);
    setSaving(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!company.trim()) {
      showToast('Company name is required', 'error');
      return;
    }

    setSaving(true);
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
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Error saving client', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete client "${name}"?`)) {
      return;
    }
    try {
      await api.deleteClient(id);
      showToast('Client deleted successfully', 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Error deleting client', 'error');
    }
  };

  const handleExportCSV = () => {
    api.exportToCSV('clients', filteredClients);
    showToast('Clients exported to CSV successfully!', 'success');
  };

  const filteredClients = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return clients.filter(c => (
      (c.company || '').toLowerCase().includes(q) ||
      (c.contact || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.country || '').toLowerCase().includes(q)
    ));
  }, [clients, searchTerm]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [filteredClients, currentPage, pageSize]);

  return (
    <div className="content-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage your client directory and contact information.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={handleExportCSV} title="Export client directory to CSV">
            <FileSpreadsheet size={16} color="#16a34a" />
            Export CSV
          </button>
          <button className="btn-primary" onClick={openAddModal}>
            <Plus size={16} />
            Add New Client
          </button>
        </div>
      </div>

      {/* Search Bar & Controls Card */}
      <div className="search-card">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search clients by name, company, or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Per page:</span>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '8px 12px', fontSize: '13px' }}
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Clients Table Card */}
      <div className="table-container">
        <div className="table-header-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>All Clients ({filteredClients.length})</span>
          <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>
            Page {currentPage} of {totalPages}
          </span>
        </div>
        <div className="table-responsive">
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
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Users size={36} color="var(--text-muted)" />
                      <strong>No clients found.</strong>
                      <button className="btn-primary btn-sm" onClick={openAddModal}>
                        <Plus size={14} /> Add Your First Client
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => (
                  <tr key={client.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{client.company}</td>
                    <td>{client.contact || '-'}</td>
                    <td>
                      <span style={{ color: 'var(--accent-primary)' }}>{client.email || '-'}</span>
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

        {/* Pagination Footer */}
        {filteredClients.length > 0 && (
          <div className="pagination-footer">
            <div className="pagination-info">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredClients.length)} of {filteredClients.length} clients
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                }
                return (
                  <button
                    key={pageNum}
                    className={`pagination-num ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                className="pagination-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
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
                    placeholder="e.g. Google India Pvt Ltd"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row-2">
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
                      placeholder="e.g. john@google.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Country</label>
                    <select
                      className="form-select"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    >
                      <option value="India">India</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="Germany">Germany</option>
                      <option value="Singapore">Singapore</option>
                      <option value="United Arab Emirates">United Arab Emirates</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. +91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? (editingClient ? 'Updating...' : 'Adding...') : (editingClient ? 'Update Client' : 'Add Client')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
