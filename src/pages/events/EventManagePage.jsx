import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import jsQR from 'jsqr';
import Topbar from '../../components/layout/Topbar.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal, { ConfirmModal } from '../../components/ui/Modal.jsx';
import { PageSpinner, Spinner } from '../../components/ui/Spinner.jsx';
import { eventsService } from '../../services/events.service.js';
import { volunteersService } from '../../services/volunteers.service.js';
import { ticketsService } from '../../services/tickets.service.js';
import { attendanceService } from '../../services/attendance.service.js';
import { feedbackService } from '../../services/feedback.service.js';
import useToastStore from '../../stores/useToastStore.js';
import Icon from '../../components/ui/Icon.jsx';
import RatingModal from '../../components/ui/RatingModal.jsx';

// ── QR Scanner Modal ─────────────────────────────────────────────────────────
function QrScannerModal({ onClose, onScan }) {
  const containerId = 'qr-reader-container';
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [isStarting, setIsStarting] = useState(true);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId, /* verbose */ false);
    scannerRef.current = scanner;
    let stopped = false;

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            // Pause scanning during processing to avoid duplicate scans
            try { await scanner.pause(true); } catch { /* ignore */ }
            await onScanRef.current(decodedText);
            // Resume after a short delay so the user can see feedback
            setTimeout(() => { try { scanner.resume(); } catch { /* ignore */ } }, 1500);
          },
          () => { /* per-frame errors are noisy — ignore */ }
        );
        if (!stopped) setIsStarting(false);
      } catch (err) {
        setError(err?.message || 'Could not access the camera. Allow camera permission and try again.');
        setIsStarting(false);
      }
    };
    start();

    return () => {
      stopped = true;
      const s = scannerRef.current;
      if (s && s.getState() !== 1 /* NOT_STARTED */) {
        s.stop().then(() => s.clear()).catch(() => { /* ignore */ });
      }
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <div className="card-title">Scan Ticket QR</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        {error ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--red-400)' }}>
            <Icon name="xCircle" size={32} />
            <div style={{ marginTop: 10, fontSize: 14 }}>{error}</div>
          </div>
        ) : (
          <>
            <div
              id={containerId}
              style={{
                width: '100%',
                minHeight: 280,
                background: '#000',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: 12,
              }}
            />
            {isStarting && (
              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                Starting camera…
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
              Point the camera at the attendee's QR code. Each scan checks them in automatically.
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { key: 'volunteers', label: 'Volunteers' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'attendance', label: 'Attendance' },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Volunteers Tab ────────────────────────────────────────────────────────────
function VolunteersTab({ eventId, eventStatus }) {
  const [needs, setNeeds] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loadingNeeds, setLoadingNeeds] = useState(true);
  const [loadingApps, setLoadingApps] = useState(true);
  const [needModal, setNeedModal] = useState(false);
  const [editingNeed, setEditingNeed] = useState(null);
  const [needForm, setNeedForm] = useState({ roleName: '', headcount: '', description: '' });
  const [savingNeed, setSavingNeed] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [ratingVolunteer, setRatingVolunteer] = useState(null); // { volunteerId, volunteerName }

  const loadNeeds = () => {
    setLoadingNeeds(true);
    volunteersService.getNeedsByEvent(eventId)
      .then((r) => setNeeds(r.data || []))
      .catch(() => useToastStore.getState().error('Failed to load volunteer needs.'))
      .finally(() => setLoadingNeeds(false));
  };

  const loadApps = () => {
    setLoadingApps(true);
    volunteersService.getApplications(eventId)
      .then((r) => setApplications(r.data || []))
      .catch(() => useToastStore.getState().error('Failed to load applications.'))
      .finally(() => setLoadingApps(false));
  };

  useEffect(() => { loadNeeds(); loadApps(); }, [eventId]);

  const openAddNeedModal = () => {
    setEditingNeed(null);
    setNeedForm({ roleName: '', headcount: '', description: '' });
    setNeedModal(true);
  };

  const openEditNeedModal = (n) => {
    setEditingNeed(n);
    setNeedForm({ roleName: n.role_name, headcount: String(n.headcount ?? ''), description: n.description || '' });
    setNeedModal(true);
  };

  const handleSaveNeed = async (e) => {
    e.preventDefault();
    if (!needForm.roleName) { useToastStore.getState().error('Role name is required.'); return; }
    setSavingNeed(true);
    const payload = {
      roleName: needForm.roleName,
      headcount: needForm.headcount ? parseInt(needForm.headcount) : undefined,
      description: needForm.description || undefined,
    };
    try {
      if (editingNeed) {
        await volunteersService.updateNeed(editingNeed.id, payload);
        useToastStore.getState().success('Volunteer role updated.');
      } else {
        await volunteersService.createNeed(eventId, payload);
        useToastStore.getState().success('Volunteer role created.');
      }
      setNeedModal(false);
      setEditingNeed(null);
      setNeedForm({ roleName: '', headcount: '', description: '' });
      loadNeeds();
    } catch (e) {
      useToastStore.getState().error(e.response?.data?.message || 'Failed to save role.');
    } finally { setSavingNeed(false); }
  };

  const handleDeleteNeed = async (id) => {
    try {
      await volunteersService.deleteNeed(id);
      useToastStore.getState().success('Role deleted.');
      loadNeeds();
    } catch (e) {
      useToastStore.getState().error(e.response?.data?.message || 'Failed to delete.');
    }
  };

  const handleReview = async (appId, status) => {
    try {
      await volunteersService.reviewApplication(appId, { status });
      useToastStore.getState().success(`Application ${status}.`);
      loadApps();
    } catch (e) {
      useToastStore.getState().error(e.response?.data?.message || 'Review failed.');
    }
  };

  const filteredApps = filterStatus
    ? applications.filter((a) => a.status === filterStatus)
    : applications;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Needs */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Volunteer Roles</div>
            <div className="card-subtitle">Define the roles you need volunteers for</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAddNeedModal}>+ Add Role</button>
        </div>

        {loadingNeeds ? <PageSpinner /> : needs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ color: 'var(--text-muted)' }}><Icon name="users" size={40} strokeWidth={1.4} /></div>
            <div className="empty-state-title">No volunteer roles yet</div>
            <div className="empty-state-desc">Add roles to accept volunteer applications.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Role</th><th>Slots</th><th>Filled</th><th>Description</th><th>Action</th></tr>
              </thead>
              <tbody>
                {needs.map((n) => (
                  <tr key={n.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{n.role_name}</td>
                    <td>{n.headcount ?? 'Unlimited'}</td>
                    <td>{n.filled_count ?? 0}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{n.description || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditNeedModal(n)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteNeed(n.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Applications */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Applications</div>
            <div className="card-subtitle">{applications.length} total</div>
          </div>
          <select
            className="input-field select-field"
            style={{ height: 36, width: 140, fontSize: 13 }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loadingApps ? <PageSpinner /> : filteredApps.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ color: "var(--text-muted)" }}><Icon name="clipboard" size={40} strokeWidth={1.4} /></div>
            <div className="empty-state-title">No applications</div>
            <div className="empty-state-desc">{filterStatus ? 'None with this status.' : 'No one has applied yet.'}</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Volunteer</th><th>Role</th><th>Status</th><th>Applied</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredApps.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {app.full_name || app.volunteer_name || app.email || app.volunteer_email || '—'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{app.email || app.volunteer_email}</div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{app.role_name || '—'}</td>
                    <td>
                      <Badge label={app.status} color={app.status === 'approved' ? 'green' : app.status === 'rejected' ? 'red' : 'amber'} />
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{fmtDate(app.applied_at || app.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {app.status === 'pending' && (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => handleReview(app.id, 'approved')}>Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleReview(app.id, 'rejected')}>Reject</button>
                          </>
                        )}
                        {app.status === 'approved' && eventStatus === 'completed' && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => setRatingVolunteer({
                              volunteerId: app.volunteer_id,
                              volunteerName: app.full_name || app.email,
                            })}
                          >
                            <Icon name="star" size={13} /> Rate
                          </button>
                        )}
                        {app.status === 'rejected' && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rejected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Need modal */}
      <Modal
        isOpen={needModal}
        onClose={() => setNeedModal(false)}
        title={editingNeed ? 'Edit Volunteer Role' : 'Add Volunteer Role'}
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setNeedModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveNeed} disabled={savingNeed}>
              {savingNeed ? <Spinner size="sm" /> : editingNeed ? 'Save Changes' : 'Create Role'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-wrap">
            <label className="input-label">Role Name *</label>
            <input className="input-field" placeholder="e.g. Registration Desk" value={needForm.roleName}
              onChange={(e) => setNeedForm((f) => ({ ...f, roleName: e.target.value }))} />
          </div>
          <div className="input-wrap">
            <label className="input-label">Headcount (slots available)</label>
            <input type="number" min="1" className="input-field" placeholder="Leave blank for unlimited"
              value={needForm.headcount} onChange={(e) => setNeedForm((f) => ({ ...f, headcount: e.target.value }))} />
          </div>
          <div className="input-wrap">
            <label className="input-label">Description</label>
            <textarea className="textarea-field" rows={3} placeholder="What will volunteers do in this role?"
              value={needForm.description} onChange={(e) => setNeedForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {ratingVolunteer && (
        <RatingModal
          title={`Rate ${ratingVolunteer.volunteerName}`}
          subtitle="How was their performance as a volunteer for this event?"
          onClose={() => setRatingVolunteer(null)}
          onSubmit={(payload) => feedbackService.rateVolunteer(eventId, ratingVolunteer.volunteerId, payload)}
          submitLabel="Submit Rating"
        />
      )}
    </div>
  );
}

// ── Tickets Tab ────────────────────────────────────────────────────────────────
function TicketsTab({ eventId }) {
  const [types, setTypes] = useState([]);
  const [sold, setSold] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingSold, setLoadingSold] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [bulking, setBulking] = useState(false);
  const [rejectConfirm, setRejectConfirm] = useState(null);
  const [bulkRejectConfirm, setBulkRejectConfirm] = useState(false);
  const [reapplyDetail, setReapplyDetail] = useState(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('');
  const [ticketSort, setTicketSort] = useState('newest');
  const [typeModal, setTypeModal] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [typeForm, setTypeForm] = useState({ name: 'General', price: '', totalQuantity: '', description: '' });
  const [savingType, setSavingType] = useState(false);

  const openAddModal = () => {
    setEditingTypeId(null);
    setTypeForm({ name: 'General', price: '', totalQuantity: '', description: '' });
    setTypeModal(true);
  };

  const openEditModal = (t) => {
    setEditingTypeId(t.id);
    setTypeForm({ name: t.name, price: String(t.price), totalQuantity: String(t.quantity ?? ''), description: t.description || '' });
    setTypeModal(true);
  };

  const loadTypes = () => {
    setLoadingTypes(true);
    ticketsService.getTicketTypes(eventId)
      .then((r) => setTypes(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingTypes(false));
  };

  const loadSold = () => {
    setLoadingSold(true);
    ticketsService.getEventTickets(eventId)
      .then((r) => setSold(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingSold(false));
  };

  useEffect(() => { loadTypes(); loadSold(); }, [eventId]);

  const handleSaveType = async (e) => {
    e.preventDefault();
    if (!typeForm.price) { useToastStore.getState().error('Price is required.'); return; }
    if (!typeForm.totalQuantity) { useToastStore.getState().error('Quantity is required.'); return; }
    setSavingType(true);
    const payload = {
      name: typeForm.name,
      price: parseFloat(typeForm.price),
      quantity: parseInt(typeForm.totalQuantity),
      description: typeForm.description || undefined,
    };
    try {
      if (editingTypeId) {
        await ticketsService.updateTicketType(editingTypeId, payload);
        useToastStore.getState().success('Ticket type updated.');
      } else {
        await ticketsService.createTicketType(eventId, payload);
        useToastStore.getState().success('Ticket type created.');
      }
      setTypeModal(false);
      setEditingTypeId(null);
      setTypeForm({ name: 'General', price: '', totalQuantity: '', description: '' });
      loadTypes();
    } catch (e) {
      useToastStore.getState().error(e.response?.data?.message || 'Failed to save ticket type.');
    } finally { setSavingType(false); }
  };

  const handleDeleteType = async (id) => {
    try {
      await ticketsService.deleteTicketType(id);
      useToastStore.getState().success('Ticket type deleted.');
      loadTypes();
    } catch (e) {
      useToastStore.getState().error(e.response?.data?.message || 'Failed to delete.');
    }
  };

  const handleConfirm = async (id) => {
    try {
      await ticketsService.confirmCashPayment(id);
      useToastStore.getState().success('Ticket confirmed.');
      loadSold();
    } catch (e) {
      useToastStore.getState().error(e.response?.data?.message || 'Failed to confirm.');
    }
  };

  const handleReject = async (id) => {
    try {
      await ticketsService.rejectPayment(id);
      useToastStore.getState().success('Ticket rejected.');
      loadSold();
    } catch (e) {
      useToastStore.getState().error(e.response?.data?.message || 'Failed to reject.');
    }
  };

  const handleBulk = async (action) => {
    if (!selectedTickets.size) return;
    setBulking(true);
    try {
      await ticketsService.bulkAction([...selectedTickets], action);
      useToastStore.getState().success(`${selectedTickets.size} ticket(s) ${action}ed.`);
      setSelectedTickets(new Set());
      loadSold();
    } catch (e) {
      useToastStore.getState().error(e.response?.data?.message || `Bulk ${action} failed.`);
    } finally { setBulking(false); }
  };

  const toggleTicket = (id) => setSelectedTickets((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const pendingTickets = sold.filter((t) => t.payment_status === 'pending' || t.payment_status === 'reapplied');
  const allPendingSelected = pendingTickets.length > 0 && pendingTickets.every((t) => selectedTickets.has(t.id));

  const toggleAllPending = () => {
    if (allPendingSelected) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(pendingTickets.map((t) => t.id)));
    }
  };

  const filteredSold = sold
    .filter((t) => {
      if (ticketStatusFilter && t.payment_status !== ticketStatusFilter) return false;
      if (ticketSearch) {
        const q = ticketSearch.toLowerCase();
        const hay = `${t.full_name || ''} ${t.buyer_name || ''} ${t.email || ''} ${t.buyer_email || ''} ${t.short_code || ''} ${t.ticket_type_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (ticketSort === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (ticketSort === 'status') return (a.payment_status || '').localeCompare(b.payment_status || '');
      if (ticketSort === 'buyer') {
        const na = a.full_name || a.buyer_name || a.email || '';
        const nb = b.full_name || b.buyer_name || b.email || '';
        return na.localeCompare(nb);
      }
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Ticket Types */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Ticket Types</div>
            <div className="card-subtitle">General, Student, Guest, VIP tiers</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAddModal}>+ Add Type</button>
        </div>
        {loadingTypes ? <PageSpinner /> : types.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ color: "var(--text-muted)" }}><Icon name="ticket" size={40} strokeWidth={1.4} /></div>
            <div className="empty-state-title">No ticket types yet</div>
            <div className="empty-state-desc">Add ticket tiers for attendees to purchase.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Type</th><th>Price</th><th>Total</th><th>Remaining</th><th>Sold</th><th>Action</th></tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t.name}</td>
                    <td>{Number(t.price || 0).toFixed(2)} ৳</td>
                    <td>{t.quantity ?? '∞'}</td>
                    <td>{t.available_quantity ?? '∞'}</td>
                    <td>{t.quantity != null && t.available_quantity != null ? (t.quantity - t.available_quantity) : (t.sold_count ?? 0)}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(t)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteType(t.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sold Tickets */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Sold Tickets</div>
            <div className="card-subtitle">
              {filteredSold.length !== sold.length
                ? `${filteredSold.length} of ${sold.length} ticket${sold.length !== 1 ? 's' : ''}`
                : `${sold.length} ticket${sold.length !== 1 ? 's' : ''} sold`}
            </div>
          </div>
          {selectedTickets.size > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedTickets.size} selected</span>
              <button className="btn btn-success btn-sm" onClick={() => handleBulk('confirm')} disabled={bulking}>
                {bulking ? 'Working…' : 'Confirm All'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => setBulkRejectConfirm(true)} disabled={bulking}>
                Reject All
              </button>
            </div>
          )}
        </div>
        {loadingSold ? <PageSpinner /> : sold.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ color: 'var(--text-muted)' }}><Icon name="inbox" size={40} strokeWidth={1.4} /></div>
            <div className="empty-state-title">No tickets sold yet</div>
          </div>
        ) : (
          <>
            <div className="filter-bar" style={{ marginBottom: 12 }}>
              <div className="search-wrap" style={{ flex: 1, minWidth: 180 }}>
                <span className="search-icon"><Icon name="search" size={14} /></span>
                <input
                  className="input-field search-input"
                  placeholder="Search buyer, email, code…"
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                />
              </div>
              <select
                className="input-field select-field"
                style={{ width: 150 }}
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="rejected">Rejected</option>
                <option value="reapplied">Reapplied</option>
              </select>
              <select
                className="input-field select-field"
                style={{ width: 150 }}
                value={ticketSort}
                onChange={(e) => setTicketSort(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="status">By status</option>
                <option value="buyer">By buyer</option>
              </select>
            </div>
            {filteredSold.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon" style={{ color: 'var(--text-muted)' }}><Icon name="search" size={32} strokeWidth={1.4} /></div>
                <div className="empty-state-title">No tickets match</div>
                <div className="empty-state-desc">Try adjusting your search or filters.</div>
              </div>
            ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" checked={allPendingSelected} onChange={toggleAllPending}
                      title="Select all pending" style={{ cursor: 'pointer' }} />
                  </th>
                  <th>Buyer</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Payment</th>
                  <th>TrxID</th>
                  <th>Status</th>
                  <th>Purchased</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSold.map((t) => {
                  const buyerName = t.full_name || t.buyer_name;
                  const buyerEmail = t.email || t.buyer_email;
                  const purchased = t.created_at || t.purchased_at;
                  const isPending = t.payment_status === 'pending';
                  const isActionable = isPending || t.payment_status === 'reapplied';
                  return (
                    <tr
                      key={t.id}
                      style={{ background: selectedTickets.has(t.id) ? 'rgba(139,92,246,0.04)' : undefined, cursor: 'pointer' }}
                      onClick={() => setReapplyDetail(t)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        {isActionable && (
                          <input type="checkbox" checked={selectedTickets.has(t.id)}
                            onChange={() => toggleTicket(t.id)} style={{ cursor: 'pointer' }} />
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{buyerName || buyerEmail || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{buyerEmail}</div>
                      </td>
                      <td>
                        {t.short_code ? (
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', background: 'rgba(139,92,246,0.08)', padding: '3px 7px', borderRadius: 4, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                            {t.short_code}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: 13 }}>{t.ticket_type_name || '—'}</td>
                      <td>
                        <Badge label={t.payment_type || 'cash'} color={t.payment_type === 'online' ? 'cyan' : 'amber'} />
                      </td>
                      <td>
                        {t.payment_reference
                          ? <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-default)', userSelect: 'all' }}>{t.payment_reference}</span>
                          : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td><Badge label={t.payment_status || 'pending'} /></td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{fmtDate(purchased)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {isActionable ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-success btn-sm" onClick={() => handleConfirm(t.id)}>Confirm</button>
                            <button className="btn btn-danger btn-sm" onClick={() => setRejectConfirm(t.id)}>Reject</button>
                          </div>
                        ) : (
                          <span
                            style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => setReapplyDetail(t)}
                          >
                            View
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
            )}
          </>
        )}
      </div>

      {/* Ticket detail modal (all rows) */}
      {reapplyDetail && (() => {
        const t = reapplyDetail;
        const isActionable = t.payment_status === 'pending' || t.payment_status === 'reapplied';
        const isReapplied = t.payment_status === 'reapplied';
        return (
          <div className="modal-overlay" onClick={() => setReapplyDetail(null)}>
            <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
              <div className="card-header">
                <div>
                  <div className="card-title">Ticket Details</div>
                  <div className="card-subtitle">{t.full_name || t.email}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setReapplyDetail(null)}><Icon name="x" size={14} /></button>
              </div>

              {/* Base info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 14 }}>
                {[
                  ['Buyer', t.full_name || '—'],
                  ['Email', t.email || '—'],
                  ['Ticket type', t.ticket_type_name || '—'],
                  ['Status', <Badge key="s" label={t.payment_status || 'pending'} />],
                  ['Payment method', t.payment_type || '—'],
                  ['Transaction ID', t.payment_reference || '—'],
                  ['Ticket code', t.short_code || '—'],
                  ['Purchased', t.created_at ? new Date(t.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-default)', fontFamily: label === 'Transaction ID' || label === 'Ticket code' ? 'monospace' : undefined, wordBreak: 'break-all' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Reapplication section */}
              {isReapplied && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                    {[
                      ['New provider', t.reapply_payment_provider || '—'],
                      ['New TrxID', t.reapply_payment_reference || '—'],
                      ['Reapplied at', t.reapply_at ? new Date(t.reapply_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'],
                    ].map(([label, val]) => (
                      <div key={label} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-default)', fontFamily: label.includes('TrxID') ? 'monospace' : undefined, wordBreak: 'break-all' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div style={{ fontSize: 11, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Reason from attendee</div>
                    <div style={{ fontSize: 13, color: 'var(--text-default)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {t.reapply_reason || '—'}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setReapplyDetail(null)}>Close</button>
                {isActionable && (
                  <>
                    <button className="btn btn-danger btn-sm" onClick={() => { setRejectConfirm(t.id); setReapplyDetail(null); }}>Reject</button>
                    <button className="btn btn-success btn-sm" onClick={async () => { await handleConfirm(t.id); setReapplyDetail(null); }}>Confirm</button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reject confirmation modals */}
      <ConfirmModal
        isOpen={!!rejectConfirm}
        onClose={() => setRejectConfirm(null)}
        onConfirm={async () => { const id = rejectConfirm; setRejectConfirm(null); await handleReject(id); }}
        title="Reject this ticket?"
        message="The attendee's payment will be marked as not confirmed and they will be notified by email. This cannot be undone."
        confirmText="Reject"
        danger
      />
      <ConfirmModal
        isOpen={bulkRejectConfirm}
        onClose={() => setBulkRejectConfirm(false)}
        onConfirm={async () => { setBulkRejectConfirm(false); await handleBulk('reject'); }}
        title={`Reject ${selectedTickets.size} ticket${selectedTickets.size !== 1 ? 's' : ''}?`}
        message="All selected attendees will be notified by email that their payment could not be confirmed."
        confirmText="Reject All"
        danger
      />

      {/* Type Modal */}
      <Modal isOpen={typeModal} onClose={() => setTypeModal(false)} title={editingTypeId ? 'Edit Ticket Type' : 'Add Ticket Type'}
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setTypeModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveType} disabled={savingType}>
              {savingType ? <Spinner size="sm" /> : editingTypeId ? 'Save Changes' : 'Create'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-wrap">
            <label className="input-label">Ticket Type *</label>
            <select className="input-field select-field" value={typeForm.name}
              onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}>
              {['General', 'Student', 'Guest', 'VIP'].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="input-wrap">
            <label className="input-label">Price (৳ BDT) *</label>
            <input type="number" min="0" step="0.01" className="input-field" placeholder="0.00"
              value={typeForm.price} onChange={(e) => setTypeForm((f) => ({ ...f, price: e.target.value }))} />
          </div>
          <div className="input-wrap">
            <label className="input-label">Total Quantity</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="button"
                onClick={() => setTypeForm((f) => ({ ...f, totalQuantity: Math.max(1, (parseInt(f.totalQuantity) || 1) - 1) }))}
                style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid var(--border-soft)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 18, fontWeight: 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color 0.15s, background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.color = 'var(--text-primary)'; }}>
                −
              </button>
              <input type="number" min="1" className="input-field"
                style={{ textAlign: 'center', flex: 1, fontWeight: 600, fontSize: 16 }}
                placeholder="∞"
                value={typeForm.totalQuantity}
                onChange={(e) => setTypeForm((f) => ({ ...f, totalQuantity: e.target.value }))} />
              <button type="button"
                onClick={() => setTypeForm((f) => ({ ...f, totalQuantity: (parseInt(f.totalQuantity) || 0) + 1 }))}
                style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid var(--border-soft)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 18, fontWeight: 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color 0.15s, background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.color = 'var(--text-primary)'; }}>
                +
              </button>
            </div>
          </div>
          <div className="input-wrap">
            <label className="input-label">Description</label>
            <input className="input-field" placeholder="Optional details"
              value={typeForm.description} onChange={(e) => setTypeForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Attendance Tab ─────────────────────────────────────────────────────────────
function AttendanceTab({ eventId }) {
  const [records, setRecords] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [volunteerApps, setVolunteerApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manualForm, setManualForm] = useState({ userId: '', userType: 'attendee' });
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastScan, setLastScan] = useState(null); // { ok: bool, message: string }
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { kind: 'check_in' | 'check_out', person }

  // Roster filters / search / sort
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | not_arrived | checked_in | checked_out
  const [typeFilter, setTypeFilter] = useState('all'); // all | attendee | volunteer
  const [sortBy, setSortBy] = useState('status'); // status | name | check_in

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      attendanceService.getEventAttendance(eventId),
      ticketsService.getEventTickets(eventId),
      volunteersService.getApplications(eventId),
    ]).then(([attRes, tixRes, appsRes]) => {
      if (attRes.status === 'fulfilled') setRecords(attRes.value.data || []);
      if (tixRes.status === 'fulfilled') setTickets(tixRes.value.data || []);
      if (appsRes.status === 'fulfilled') {
        // Only approved volunteer applications count as expected
        const apps = (appsRes.value.data || []).filter((a) => a.status === 'approved');
        setVolunteerApps(apps);
      }
      if (attRes.status === 'rejected') useToastStore.getState().error('Failed to load attendance.');
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [eventId]);

  // Build the unified roster: every expected person + their check-in status
  const roster = (() => {
    const byUserId = new Map();

    // 1. Add ticket buyers (attendees) — only confirmed tickets
    tickets
      .filter((t) => (t.payment_status || t.status) === 'confirmed')
      .forEach((t) => {
        if (!t.user_id || byUserId.has(t.user_id)) return;
        byUserId.set(t.user_id, {
          user_id: t.user_id,
          full_name: t.full_name || t.user_name,
          email: t.email || t.user_email,
          photo_url: t.photo_url,
          user_type: 'attendee',
          extra: t.ticket_type_name ? `Ticket · ${t.ticket_type_name}` : 'Ticket holder',
          ticket_id: t.id,
          short_code: t.short_code,
          expires_at: t.expires_at,
          ticket_type_name: t.ticket_type_name,
          payment_status: t.payment_status,
        });
      });

    // 2. Add approved volunteers
    volunteerApps.forEach((a) => {
      if (!a.volunteer_id || byUserId.has(a.volunteer_id)) return;
      byUserId.set(a.volunteer_id, {
        user_id: a.volunteer_id,
        full_name: a.full_name || a.volunteer_name,
        email: a.email || a.volunteer_email,
        photo_url: a.photo_url,
        user_type: 'volunteer',
        extra: a.role_name ? `Role · ${a.role_name}` : 'Volunteer',
      });
    });

    // 3. Overlay attendance status
    records.forEach((r) => {
      const checkIn = r.check_in_time || r.checked_in_at;
      const checkOut = r.check_out_time || r.checked_out_at;
      const existing = byUserId.get(r.user_id) || {
        user_id: r.user_id,
        full_name: r.full_name || r.user_name,
        email: r.email || r.user_email,
        photo_url: r.photo_url,
        user_type: r.user_type || 'attendee',
        extra: r.user_type === 'volunteer' ? 'Volunteer' : 'Walk-in',
      };
      byUserId.set(r.user_id, {
        ...existing,
        attendance_id: r.id,
        check_in_time: checkIn,
        check_out_time: checkOut,
        notes: r.notes,
        ticket_id: existing.ticket_id || r.ticket_id,
        short_code: existing.short_code,
        expires_at: existing.expires_at,
        ticket_type_name: existing.ticket_type_name,
        payment_status: existing.payment_status,
        student_id: r.student_id || existing.student_id,
        batch: r.batch || existing.batch,
        section: r.section || existing.section,
        department: r.department || existing.department,
        skills: r.skills || existing.skills,
      });
    });

    return Array.from(byUserId.values());
  })();

  const getStatus = (p) =>
    !p.check_in_time ? 'not_arrived' : !p.check_out_time ? 'checked_in' : 'checked_out';

  // Base for stats: apply search + type, but NOT status (so the status breakdown
  // stays meaningful — picking "Checked out" doesn't zero out the other cards).
  const matchesScope = (p) => {
    if (typeFilter !== 'all' && p.user_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${p.full_name || ''} ${p.email || ''} ${p.extra || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const scoped = roster.filter(matchesScope);

  const filtered = scoped
    .filter((p) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'ever_checked_in') return !!p.check_in_time;
      return getStatus(p) === statusFilter;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '');
      if (sortBy === 'check_in') {
        const at = a.check_in_time ? new Date(a.check_in_time).getTime() : Infinity;
        const bt = b.check_in_time ? new Date(b.check_in_time).getTime() : Infinity;
        return at - bt;
      }
      // status: not_arrived first, then checked_in, then checked_out
      const order = { not_arrived: 0, checked_in: 1, checked_out: 2 };
      return order[getStatus(a)] - order[getStatus(b)];
    });

  const counts = {
    total: scoped.length,
    not_arrived: scoped.filter((p) => getStatus(p) === 'not_arrived').length,
    checked_in: scoped.filter((p) => getStatus(p) === 'checked_in').length,
    checked_out: scoped.filter((p) => getStatus(p) === 'checked_out').length,
    total_check_ins: scoped.filter((p) => p.check_in_time).length, // anyone who has ever checked in
  };

  const handleQuickCheckIn = async (p) => {
    try {
      await attendanceService.checkInManual(eventId, p.user_id, p.user_type);
      useToastStore.getState().success(`${p.full_name || p.email} checked in.`);
      load();
    } catch (e) {
      useToastStore.getState().error(e.response?.data?.message || 'Check-in failed.');
    }
  };

  const handleQrScan = async (decodedText) => {
    try {
      await attendanceService.checkInByQR(decodedText);
      setLastScan({ ok: true, message: 'Checked in successfully' });
      useToastStore.getState().success('Check-in successful.');
      load();
    } catch (e) {
      setLastScan({ ok: false, message: e.response?.data?.message || 'Invalid or already-used QR' });
    }
  };

  const decodeQrFromImage = (img) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Try both orientations — jsqr can be picky about inversion on dark-background QRs
    const code =
      jsQR(data, width, height, { inversionAttempts: 'attemptBoth' }) ||
      jsQR(data, width, height, { inversionAttempts: 'invertFirst' });
    return code?.data || null;
  };

  const handleUploadQr = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setLastScan({ ok: false, message: 'Please select an image file (PNG, JPG, WebP).' });
      return;
    }
    setUploading(true);
    setLastScan(null);

    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Failed to load image'));
        i.src = objectUrl;
      });

      const decoded = decodeQrFromImage(img);
      if (decoded) {
        await handleQrScan(decoded);
      } else {
        setLastScan({
          ok: false,
          message: 'No QR code found. Make sure the QR fills most of the frame and is not rotated or blurry.',
        });
      }
    } catch (err) {
      setLastScan({ ok: false, message: err?.message || 'Could not read the image file.' });
    } finally {
      URL.revokeObjectURL(objectUrl);
      setUploading(false);
    }
  };

  // Resolve an identifier (UUID, email, or short ticket ID) to a user_id
  // by searching the already-loaded roster. Returns { ok, user, matches } where
  // `matches` is the list of candidates if ambiguous.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const resolveIdentifier = (raw) => {
    const q = (raw || '').trim();
    if (!q) return { ok: false, error: 'Enter an email, ticket ID, or user UUID.' };

    // Direct UUID — could be a user_id or a ticket_id
    if (UUID_RE.test(q)) {
      const byUser = roster.find((p) => p.user_id?.toLowerCase() === q.toLowerCase());
      if (byUser) return { ok: true, user: byUser };
      const byTicket = roster.find((p) => p.ticket_id?.toLowerCase() === q.toLowerCase());
      if (byTicket) return { ok: true, user: byTicket };
      // Not in roster — assume it's a user_id and let the API decide
      return { ok: true, user: { user_id: q, full_name: null, email: q, user_type: manualForm.userType } };
    }

    // Email match
    if (q.includes('@')) {
      const matches = roster.filter((p) => p.email?.toLowerCase() === q.toLowerCase());
      if (matches.length === 0) return { ok: false, error: `No ticket holder or volunteer with email "${q}" for this event.` };
      if (matches.length === 1) return { ok: true, user: matches[0] };
      return { ok: false, ambiguous: true, matches, error: `${matches.length} people share that email — pick one below.` };
    }

    // Short ticket ID prefix (e.g. "92bb7bcb")
    const prefix = q.toLowerCase();
    const matches = roster.filter(
      (p) =>
        p.ticket_id?.toLowerCase().startsWith(prefix) ||
        p.user_id?.toLowerCase().startsWith(prefix)
    );
    if (matches.length === 0) return { ok: false, error: `No match for "${q}". Try the full email or ticket UUID.` };
    if (matches.length === 1) return { ok: true, user: matches[0] };
    return { ok: false, ambiguous: true, matches, error: `${matches.length} matches — narrow it down.` };
  };

  const [resolveAmbig, setResolveAmbig] = useState(null); // { matches: [...] }

  const handleCheckIn = async (e) => {
    e.preventDefault();
    const raw = (manualForm.userId || '').trim();
    if (!raw) {
      useToastStore.getState().error('Enter an email, ticket code, or UUID.');
      return;
    }

    // Short ticket code (TKT-XXXXXXXX) — short-circuit to the dedicated endpoint.
    // No need to look it up in the roster — backend validates expiry, event match, etc.
    if (/^TKT-[A-Z0-9]+$/i.test(raw)) {
      setSaving(true);
      try {
        const res = await attendanceService.checkInByShortCode(eventId, raw.toUpperCase());
        useToastStore.getState().success(`Checked in by ticket code ${raw.toUpperCase()}.`);
        setManualForm({ userId: '', userType: 'attendee' });
        load();
      } catch (err) {
        useToastStore.getState().error(err.response?.data?.message || 'Check-in failed.');
      } finally { setSaving(false); }
      return;
    }

    const r = resolveIdentifier(raw);
    if (!r.ok) {
      useToastStore.getState().error(r.error);
      if (r.ambiguous) setResolveAmbig({ matches: r.matches });
      return;
    }
    setResolveAmbig(null);
    // Inferred type from roster wins over the dropdown when we know it
    const userType = r.user.user_type || manualForm.userType;
    setSaving(true);
    try {
      await attendanceService.checkInManual(eventId, r.user.user_id, userType);
      useToastStore.getState().success(`Checked in ${r.user.full_name || r.user.email || r.user.user_id}.`);
      setManualForm({ userId: '', userType: 'attendee' });
      load();
    } catch (err) {
      useToastStore.getState().error(err.response?.data?.message || 'Check-in failed.');
    } finally { setSaving(false); }
  };

  const handleCheckOut = async (userId) => {
    try {
      await attendanceService.checkOut(eventId, userId);
      useToastStore.getState().success('Check-out recorded.');
      load();
    } catch (e) {
      useToastStore.getState().error(e.response?.data?.message || 'Check-out failed.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats — clickable to filter by status. Reflect search + type filter. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {[
          { key: 'all',              label: 'Expected',        value: counts.total,           icon: 'users',        color: 'cyan'   },
          { key: 'not_arrived',      label: 'Not arrived',     value: counts.not_arrived,     icon: 'clock',        color: 'amber'  },
          { key: 'checked_in',       label: 'Currently in',    value: counts.checked_in,      icon: 'checkCircle',  color: 'green'  },
          { key: 'checked_out',      label: 'Checked out',     value: counts.checked_out,     icon: 'x',            color: 'slate'  },
          { key: 'ever_checked_in',  label: 'Total check-ins', value: counts.total_check_ins, icon: 'award',        color: 'purple' },
        ].map((s) => {
          const active = statusFilter === s.key;
          return (
            <div
              key={s.key}
              className="stat-card"
              onClick={() => setStatusFilter(s.key)}
              style={{
                cursor: 'pointer',
                borderColor: active ? 'var(--accent)' : undefined,
                boxShadow: active ? '0 0 0 1px var(--accent), 0 0 12px rgba(34,211,238,0.15)' : undefined,
                transition: 'all var(--transition-fast)',
              }}
            >
              <div className={`stat-card-icon ${s.color}`}><Icon name={s.icon} size={20} /></div>
              <div className="stat-card-body">
                <div className="stat-card-value">{s.value}</div>
                <div className="stat-card-label">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* QR scanner */}
      <div className="card" style={{ borderColor: 'rgba(34,211,238,0.25)' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Scan Ticket QR</div>
            <div className="card-subtitle">Scan with the camera or upload a QR image / screenshot</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Icon name="download" size={14} style={{ transform: 'rotate(180deg)' }} />
              {uploading ? 'Decoding…' : 'Upload QR Code'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => { setLastScan(null); setScannerOpen(true); }}>
              <Icon name="qr" size={14} /> Open Scanner
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadQr}
              style={{ display: 'none' }}
            />
          </div>
        </div>
        {lastScan && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: lastScan.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${lastScan.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: lastScan.ok ? 'var(--green-400)' : 'var(--red-400)',
            fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Icon name={lastScan.ok ? 'checkCircle' : 'xCircle'} size={16} />
            {lastScan.message}
          </div>
        )}
      </div>

      {scannerOpen && (
        <QrScannerModal
          onClose={() => setScannerOpen(false)}
          onScan={handleQrScan}
        />
      )}

      {/* Manual check-in */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 4 }}>Manual Check-in</div>
        <div className="card-subtitle" style={{ marginBottom: 16 }}>
          Enter the attendee's <strong>ticket code</strong> (e.g. <code>TKT-A4B7K9X3</code>) or email.
        </div>
        <form onSubmit={handleCheckIn} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="input-wrap" style={{ flex: 1, minWidth: 240 }}>
            <label className="input-label">Ticket code or email</label>
            <input
              className="input-field"
              placeholder="TKT-A4B7K9X3   |   rocky@example.com"
              value={manualForm.userId}
              onChange={(e) => { setManualForm((f) => ({ ...f, userId: e.target.value })); setResolveAmbig(null); }}
              style={/^tkt-/i.test(manualForm.userId) ? { fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' } : undefined}
            />
          </div>
          <div className="input-wrap" style={{ width: 140 }}>
            <label className="input-label">User Type</label>
            <select className="input-field select-field" value={manualForm.userType}
              onChange={(e) => setManualForm((f) => ({ ...f, userType: e.target.value }))}>
              <option value="attendee">Attendee</option>
              <option value="volunteer">Volunteer</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Spinner size="sm" /> : 'Check In'}
          </button>
        </form>

        {resolveAmbig && (
          <div style={{
            marginTop: 14,
            padding: 14,
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ fontSize: 13, color: 'var(--amber-400)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="warning" size={14} /> Multiple matches — pick the right person:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {resolveAmbig.matches.map((m) => (
                <button
                  key={m.user_id + (m.ticket_id || '')}
                  type="button"
                  onClick={async () => {
                    setResolveAmbig(null);
                    setSaving(true);
                    try {
                      await attendanceService.checkInManual(eventId, m.user_id, m.user_type || manualForm.userType);
                      useToastStore.getState().success(`Checked in ${m.full_name || m.email || m.user_id}.`);
                      setManualForm({ userId: '', userType: 'attendee' });
                      load();
                    } catch (err) {
                      useToastStore.getState().error(err.response?.data?.message || 'Check-in failed.');
                    } finally { setSaving(false); }
                  }}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{m.full_name || m.email || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {m.email}{m.extra ? ` · ${m.extra}` : ''}
                      {m.ticket_id ? ` · Ticket ${m.ticket_id.slice(0, 8)}` : ''}
                    </div>
                  </div>
                  <Badge label={m.user_type || 'attendee'} color={m.user_type === 'volunteer' ? 'green' : 'cyan'} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Roster */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Event Roster</div>
            <div className="card-subtitle">Everyone expected at this event · {filtered.length} of {counts.total}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <div className="search-wrap" style={{ flex: 1, minWidth: 220 }}>
            <span className="search-icon">
              <Icon name="search" size={14} />
            </span>
            <input
              className="input-field search-input"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input-field select-field" style={{ width: 160 }}
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="not_arrived">Not arrived</option>
            <option value="checked_in">Currently in</option>
            <option value="checked_out">Checked out</option>
            <option value="ever_checked_in">Has checked in (any)</option>
          </select>
          <select className="input-field select-field" style={{ width: 140 }}
            value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            <option value="attendee">Attendees</option>
            <option value="volunteer">Volunteers</option>
          </select>
          <select className="input-field select-field" style={{ width: 150 }}
            value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="status">Sort: Status</option>
            <option value="name">Sort: Name</option>
            <option value="check_in">Sort: Check-in time</option>
          </select>
        </div>

        {loading ? <PageSpinner /> : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ color: 'var(--text-muted)' }}>
              <Icon name="clipboard" size={40} strokeWidth={1.4} />
            </div>
            <div className="empty-state-title">
              {counts.total === 0 ? 'No one expected yet' : 'No matches'}
            </div>
            <div className="empty-state-desc">
              {counts.total === 0
                ? 'Once people buy tickets or volunteers are approved, they\'ll show up here.'
                : 'Try a different search or filter.'}
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const status = getStatus(p);
                  const statusLabel = { not_arrived: 'Not arrived', checked_in: 'Currently in', checked_out: 'Checked out' }[status];
                  const statusColor = { not_arrived: 'amber', checked_in: 'green', checked_out: 'slate' }[status];
                  return (
                    <tr
                      key={p.user_id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setDetailRecord(p)}
                    >
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {p.full_name || p.email || '—'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.email}</div>
                        {p.extra && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.extra}</div>}
                      </td>
                      <td>
                        <Badge label={p.user_type} color={p.user_type === 'volunteer' ? 'green' : 'cyan'} />
                      </td>
                      <td>
                        <Badge label={statusLabel} color={statusColor} />
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {p.check_in_time ? new Date(p.check_in_time).toLocaleTimeString() : '—'}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {p.check_out_time ? new Date(p.check_out_time).toLocaleTimeString() : '—'}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {status === 'not_arrived' && (
                          <button className="btn btn-success btn-sm" onClick={() => setConfirmAction({ kind: 'check_in', person: p })}>
                            Check In
                          </button>
                        )}
                        {status === 'checked_in' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => setConfirmAction({ kind: 'check_out', person: p })}>
                            Check Out
                          </button>
                        )}
                        {status === 'checked_out' && (
                          <button className="btn btn-success btn-sm" onClick={() => setConfirmAction({ kind: 'check_in', person: p })}>
                            Re-check In
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailRecord && (
        <AttendeeDetailModal
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
          onCheckOut={(userId) => setConfirmAction({ kind: 'check_out', person: { user_id: userId, full_name: detailRecord.full_name, email: detailRecord.email } })}
          onCheckIn={(p) => setConfirmAction({ kind: 'check_in', person: p })}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          isOpen={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={async () => {
            const { kind, person } = confirmAction;
            setConfirmAction(null);
            setDetailRecord(null);
            if (kind === 'check_in') await handleQuickCheckIn(person);
            else await handleCheckOut(person.user_id);
          }}
          title={confirmAction.kind === 'check_in' ? 'Confirm check-in' : 'Confirm check-out'}
          message={
            confirmAction.kind === 'check_in'
              ? `Check in ${confirmAction.person.full_name || confirmAction.person.email || 'this person'}? Their arrival will be recorded with the current time.`
              : `Check out ${confirmAction.person.full_name || confirmAction.person.email || 'this person'}? They'll be marked as having left the venue.`
          }
          confirmText={confirmAction.kind === 'check_in' ? 'Check In' : 'Check Out'}
          danger={confirmAction.kind === 'check_out'}
        />
      )}
    </div>
  );
}

// ── Attendee Detail Modal ────────────────────────────────────────────────────
function AttendeeDetailModal({ record, onClose, onCheckOut, onCheckIn }) {
  const checkIn = record.check_in_time || record.checked_in_at;
  const checkOut = record.check_out_time || record.checked_out_at;
  const name = record.full_name || record.user_name || 'Unnamed';
  const email = record.email || record.user_email || '—';

  const fmtFull = (d) => d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const duration = checkIn ? (() => {
    const end = checkOut ? new Date(checkOut) : new Date();
    const ms = end - new Date(checkIn);
    const mins = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })() : '—';

  const fields = [
    { label: 'Full name', value: name },
    { label: 'Email', value: email },
    { label: 'Role at event', value: <Badge label={record.user_type || 'attendee'} color={record.user_type === 'volunteer' ? 'green' : 'cyan'} /> },
    { label: 'Ticket type', value: record.ticket_type_name },
    { label: 'Payment', value: record.payment_status ? <Badge label={record.payment_status} color={record.payment_status === 'confirmed' ? 'green' : 'amber'} /> : null },
    { label: 'Student ID', value: record.student_id },
    { label: 'Batch', value: record.batch },
    { label: 'Section', value: record.section },
    { label: 'Department', value: record.department },
    { label: 'Phone', value: record.phone },
    { label: 'Check-in time', value: fmtFull(checkIn) },
    { label: 'Check-out time', value: fmtFull(checkOut) },
    { label: 'Duration in venue', value: duration },
    { label: 'Status', value: <Badge label={!checkIn ? 'not arrived' : !checkOut ? 'checked in' : 'checked out'} color={!checkIn ? 'slate' : !checkOut ? 'green' : 'amber'} /> },
    { label: 'Ticket expires', value: record.expires_at ? fmtFull(record.expires_at) : null },
    { label: 'Notes', value: record.notes },
    { label: 'Ticket UUID', value: record.ticket_id ? <span style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{record.ticket_id}</span> : '—' },
    { label: 'User ID', value: record.user_id ? <span style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{record.user_id}</span> : '—' },
    { label: 'Recorded at', value: fmtFull(record.created_at) },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
            {record.photo_url ? (
              <img
                src={record.photo_url}
                alt={name}
                style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(34,211,238,0.3)' }}
              />
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(34,211,238,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent)', fontWeight: 700, fontSize: 20,
                flexShrink: 0,
              }}>
                {(name || email || '?').toString().trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div className="card-title" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {email}
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        {record.short_code && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(8,145,178,0.06))',
            border: '1px solid rgba(34,211,238,0.35)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            margin: '12px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <Icon name="ticket" size={20} color="var(--accent)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                Ticket code
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--accent)',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
                userSelect: 'all',
              }}>
                {record.short_code}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                navigator.clipboard?.writeText(record.short_code);
                useToastStore.getState().success('Code copied to clipboard.');
              }}
              title="Copy"
            >
              Copy
            </button>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px 24px',
          marginTop: 8,
        }}>
          {fields.map(({ label, value }) => (
            <div key={label} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 14, color: 'var(--text-default)' }}>
                {value == null || value === '' ? '—' : value}
              </div>
            </div>
          ))}
        </div>

        {record.skills?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Skills</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {record.skills.map((s) => (
                <span key={s} className="badge badge-slate">{s}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          {!checkIn && onCheckIn && (
            <button className="btn btn-success btn-sm" onClick={() => onCheckIn(record)}>
              Check In
            </button>
          )}
          {checkIn && !checkOut && (
            <button className="btn btn-danger btn-sm" onClick={() => onCheckOut(record.user_id)}>
              Check Out
            </button>
          )}
          {checkIn && checkOut && onCheckIn && (
            <button className="btn btn-success btn-sm" onClick={() => onCheckIn(record)}>
              Re-check In
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EventManagePage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('volunteers');
  const navigate = useNavigate();

  useEffect(() => {
    eventsService.getEvent(id)
      .then((r) => setEvent(r.data))
      .catch(() => { useToastStore.getState().error('Event not found.'); navigate('/events'); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return (
    <>
      <Topbar />
      <div className="page-content"><PageSpinner /></div>
    </>
  );

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div className="page-header">
          <div>
            <div className="page-title">{event?.title || ''}</div>
            <div className="page-subtitle">Volunteers · Tickets · Attendance</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/events/${id}`)}>
            <Icon name="arrowLeft" size={14} /> Back to Event
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className="btn btn-ghost"
              style={{
                borderRadius: '8px 8px 0 0',
                borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: tab === t.key ? 600 : 400,
              }}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'volunteers' && <VolunteersTab eventId={id} eventStatus={event?.status} />}
        {tab === 'tickets' && <TicketsTab eventId={id} />}
        {tab === 'attendance' && <AttendanceTab eventId={id} />}
      </div>
    </>
  );
}
