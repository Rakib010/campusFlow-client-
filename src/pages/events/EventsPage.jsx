import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { PageSpinner } from '../../components/ui/Spinner.jsx';
import { eventsService } from '../../services/events.service.js';
import useAuthStore from '../../stores/useAuthStore.js';
import Icon from '../../components/ui/Icon.jsx';
import useToastStore from '../../stores/useToastStore.js';
import SelectMenu from '../../components/ui/SelectMenu.jsx';

const STATUSES = ['', 'published', 'ongoing', 'completed', 'cancelled', 'draft'];
const CAN_CREATE = ['ORGANIZER', 'ADMIN'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { user } = useAuthStore();
  const toast = useToastStore();
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 12 };
    if (search) params.search = search;
    if (status) params.status = status;
    eventsService.listEvents(params)
      .then((r) => {
        setEvents(r.data || []);
        if (r.pagination) {
          setPagination({ ...r.pagination, totalPages: r.pagination.pages || 1 });
        }
      })
      .catch((e) => useToastStore.getState().error(e.response?.data?.message || 'Failed to load events'))
      .finally(() => setLoading(false));
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  const canCreate = CAN_CREATE.includes(user?.role);

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div className="page-header">
          <div>
            <div className="page-title">Events</div>
            <div className="page-subtitle">Browse and manage campus events{pagination.total != null ? ` · ${pagination.total} total` : ''}</div>
          </div>
          {canCreate && (
            <div className="page-actions">
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/events/create')}>
                + New Event
              </button>
            </div>
          )}
        </div>

        <div className="filter-bar">
          <div className="search-wrap events-filter-search">
            <span className="search-icon">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <input
              className="search-input"
              placeholder="Search events…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <SelectMenu
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            placeholder="All statuses"
            width={160}
            options={STATUSES.filter(Boolean).map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
          />
        </div>

        {loading ? <PageSpinner /> : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ color: 'var(--text-muted)' }}>
              <Icon name="calendar" size={40} strokeWidth={1.4} />
            </div>
            <div className="empty-state-title">No events found</div>
            <div className="empty-state-desc">Try adjusting your filters or create a new event.</div>
          </div>
        ) : (
          <div className="events-grid">
            {events.map((ev) => <EventCard key={ev.id} event={ev} onClick={() => navigate(`/events/${ev.id}`)} />)}
          </div>
        )}

        <Pagination
          page={pagination.page || page}
          totalPages={pagination.totalPages || 1}
          onPageChange={(p) => setPage(p)}
        />
      </div>
    </>
  );
}

function EventCard({ event: ev, onClick }) {
  return (
    <div
      className="card card-sm"
      style={{ cursor: 'pointer', transition: 'border-color var(--transition-fast)', padding: 0, overflow: 'hidden' }}
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
    >
      {/* Banner */}
      <div style={{
        height: 120,
        background: ev.banner_url
          ? `url(${ev.banner_url}) center/cover no-repeat`
          : 'linear-gradient(135deg, var(--slate-800), var(--slate-900))',
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 10, right: 10, backdropFilter: 'blur(6px)', borderRadius: 999 }}>
          <Badge label={ev.status} />
        </div>
      </div>

      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
          {ev.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          {ev.category
            ? <span style={{ fontSize: 12, color: 'var(--accent)' }}>{ev.category}</span>
            : <span />
          }
          <span className={`badge ${ev.is_paid ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: 11, padding: '2px 8px' }}>
            {ev.is_paid ? 'Paid' : 'Free'}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ev.start_date && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
              <Icon name="calendar" size={13} />
              <span>{new Date(ev.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          )}
          {(ev.venue || ev.location) && (() => {
            const v = ev.venue || ev.location;
            const online = /^https?:\/\//i.test(v);
            return (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                <Icon name={online ? 'spark' : 'mapPin'} size={13} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {online ? 'Online' : v}
                </span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
