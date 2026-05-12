import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { PageSpinner } from '../../components/ui/Spinner.jsx';
import { ConfirmModal } from '../../components/ui/Modal.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { usersService } from '../../services/users.service.js';
import useToastStore from '../../stores/useToastStore.js';

const ROLES = ['ADMIN', 'ORGANIZER', 'VOLUNTEER', 'ATTENDEE'];
const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'created_at:asc', label: 'Oldest first' },
  { value: 'full_name:asc', label: 'Name A–Z' },
  { value: 'full_name:desc', label: 'Name Z–A' },
  { value: 'role:asc', label: 'Role A–Z' },
];

function KebabMenu({ user, onView, onToggleActive, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const action = (fn) => () => { setOpen(false); fn(); };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-subtle)',
          background: open ? 'var(--bg-hover)' : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 18, fontWeight: 700, lineHeight: 1,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = 'transparent'; }}
      >
        ⋮
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 36, zIndex: 100,
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
          minWidth: 160, overflow: 'hidden',
        }}>
          <MenuItem icon="eye" label="View profile" onClick={action(onView)} />
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />
          <MenuItem
            icon="power"
            label={user.is_active ? 'Deactivate' : 'Activate'}
            color={user.is_active ? 'var(--amber-400)' : 'var(--green-400)'}
            onClick={action(onToggleActive)}
          />
          <MenuItem icon="trash" label="Delete" color="var(--red-400)" onClick={action(onDelete)} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, color, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px', border: 'none', background: hover ? 'var(--bg-hover)' : 'transparent',
        cursor: 'pointer', color: color || 'var(--text-primary)', fontSize: 13,
        textAlign: 'left', transition: 'background 0.12s',
      }}
    >
      <Icon name={icon} size={14} strokeWidth={2} color={color || 'var(--text-muted)'} />
      {label}
    </button>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('created_at:desc');
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    const [sortBy, sortOrder] = sort.split(':');
    const params = { page, limit: 15, sortBy, sortOrder };
    if (search) params.search = search;
    if (role) params.role = role;
    if (statusFilter) params.isActive = statusFilter;

    usersService.listUsers(params)
      .then((main) => {
        setUsers(main.data || []);
        if (main.pagination) {
          setPagination({ ...main.pagination, totalPages: main.pagination.pages || 1 });
        }
      })
      .catch(() => useToastStore.getState().error('Failed to load users'))
      .finally(() => setLoading(false));
  }, [page, search, role, statusFilter, sort]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id, name) => {
    try {
      await usersService.approveOrganizer(id);
      useToastStore.getState().success(`${name} approved as organizer.`);
      load();
    } catch (e) {
      useToastStore.getState().error(e.response?.data?.message || 'Approval failed.');
    }
  };

  const handleToggleActive = async (id, current) => {
    try {
      await usersService.toggleActive(id, !current);
      useToastStore.getState().success(`User ${!current ? 'activated' : 'deactivated'}.`);
      load();
    } catch (e) {
      useToastStore.getState().error(e.response?.data?.message || 'Action failed.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await usersService.deleteUser(id);
      useToastStore.getState().success('User deleted.');
      setConfirmDelete(null);
      load();
    } catch (e) {
      useToastStore.getState().error(e.response?.data?.message || 'Delete failed.');
    }
  };

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div className="page-header">
          <div>
            <div className="page-title">Users</div>
            <div className="page-subtitle">
              Manage platform members{pagination.total != null ? ` · ${pagination.total} total` : ''}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="search-wrap" style={{ flex: '1 1 220px', minWidth: 180 }}>
            <span className="search-icon">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <input
              className="search-input"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="input-field select-field"
            style={{ height: 40, width: 148 }}
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
            ))}
          </select>
          <select
            className="input-field select-field"
            style={{ height: 40, width: 148 }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <select
            className="input-field select-field"
            style={{ height: 40, width: 160 }}
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="table-wrap">
          {loading ? (
            <PageSpinner />
          ) : users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ color: 'var(--text-muted)' }}>
                <Icon name="users" size={40} strokeWidth={1.4} />
              </div>
              <div className="empty-state-title">No users found</div>
              <div className="empty-state-desc">Try adjusting your search or filters.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Approved</th>
                  <th>Joined</th>
                  <th style={{ width: 48 }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const name = u.full_name || u.email?.split('@')[0] || 'Unknown';
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={name} src={u.photo_url} size="sm" />
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><Badge label={u.role} /></td>
                      <td><Badge label={u.is_active ? 'active' : 'inactive'} /></td>
                      <td>
                        {u.role === 'ORGANIZER'
                          ? <Badge label={u.is_approved ? 'approved' : 'pending'} />
                          : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Auto</span>}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {u.role === 'ORGANIZER' && !u.is_approved && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleApprove(u.id, name)}
                            >
                              Approve
                            </button>
                          )}
                          <KebabMenu
                            user={u}
                            onView={() => navigate(`/users/${u.id}`)}
                            onToggleActive={() => handleToggleActive(u.id, u.is_active)}
                            onDelete={() => setConfirmDelete(u)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          page={pagination.page || page}
          totalPages={pagination.totalPages || 1}
          onPageChange={(p) => setPage(p)}
        />

        <ConfirmModal
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete.id)}
          title="Delete User"
          message={`Are you sure you want to permanently delete ${confirmDelete?.full_name || confirmDelete?.email}? This cannot be undone.`}
          confirmText="Delete"
          danger
        />
      </div>
    </>
  );
}
