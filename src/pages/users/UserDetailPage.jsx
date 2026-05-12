import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { PageSpinner } from '../../components/ui/Spinner.jsx';
import { ConfirmModal } from '../../components/ui/Modal.jsx';
import StarRating from '../../components/ui/StarRating.jsx';
import { usersService } from '../../services/users.service.js';
import { feedbackService } from '../../services/feedback.service.js';
import useAuthStore from '../../stores/useAuthStore.js';
import useToastStore from '../../stores/useToastStore.js';

const ROLES = ['ATTENDEE', 'VOLUNTEER', 'ORGANIZER', 'ADMIN'];

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ width: 140, flexShrink: 0, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--text-default)' }}>{value || '—'}</span>
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingRole, setPendingRole] = useState(null); // role we're about to confirm
  const [changingRole, setChangingRole] = useState(false);
  const [ratings, setRatings] = useState(null); // { average, count }
  const { user: me } = useAuthStore();
  const toast = useToastStore();
  const navigate = useNavigate();
  const isAdmin = me?.role === 'ADMIN';
  const isSelf = me?.id === id;

  useEffect(() => {
    usersService.getUserById(id)
      .then((r) => {
        const u = r.data;
        setUser(u);
        // Fetch ratings if relevant
        const fetcher = u.role === 'VOLUNTEER' ? feedbackService.getVolunteerRatings(id)
                      : (u.role === 'ORGANIZER' || u.role === 'ADMIN') ? feedbackService.getOrganizerRatings(id)
                      : null;
        if (fetcher) {
          fetcher.then((rr) => {
            const list = Array.isArray(rr.data) ? rr.data : rr.data?.ratings || [];
            if (list.length > 0) {
              const avg = list.reduce((acc, r) => acc + (r.rating || r.score || 0), 0) / list.length;
              setRatings({ average: avg, count: list.length, list });
            } else {
              setRatings({ average: 0, count: 0, list: [] });
            }
          }).catch(() => { /* ratings missing — no big deal */ });
        }
      })
      .catch((e) => {
        toast.error(e.response?.data?.message || 'User not found.');
        navigate('/users');
      })
      .finally(() => setLoading(false));
  }, [id, navigate, toast]);

  const handleApprove = async () => {
    try {
      await usersService.approveOrganizer(id);
      toast.success('Organizer approved!');
      setUser((u) => ({ ...u, is_approved: true }));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to approve.');
    }
  };

  const handleToggleActive = async () => {
    try {
      await usersService.toggleActive(id, !user.is_active);
      toast.success(`User ${!user.is_active ? 'activated' : 'deactivated'}.`);
      setUser((u) => ({ ...u, is_active: !u.is_active }));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed.');
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!pendingRole) return;
    setChangingRole(true);
    try {
      const r = await usersService.changeRole(id, pendingRole);
      toast.success(`Role changed to ${pendingRole.replace('_', ' ')}.`);
      setUser((u) => ({ ...u, role: r.data.role, is_approved: r.data.is_approved }));
      setPendingRole(null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to change role.');
    } finally {
      setChangingRole(false);
    }
  };

  if (loading) return (
    <>
      <Topbar />
      <div className="page-content"><PageSpinner /></div>
    </>
  );

  if (!user) return null;

  const name = user.full_name || user.email?.split('@')[0] || 'Unknown';

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div className="page-header">
          <div>
            <div className="page-title">{name}</div>
            <div className="page-subtitle">User details and account info</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/users')}>← Back</button>
          {user.role === 'ORGANIZER' && !user.is_approved && (
            <button className="btn btn-success btn-sm" onClick={handleApprove}>Approve Organizer</button>
          )}
          <button
            className={`btn btn-sm ${user.is_active ? 'btn-danger' : 'btn-success'}`}
            onClick={handleToggleActive}
          >{user.is_active ? 'Deactivate' : 'Activate'}</button>
        </div>

        <div className="content-grid">
          {/* Profile Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <Avatar name={name} src={user.photo_url} size="xl" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>{user.email}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Badge label={user.role} />
                  <Badge label={user.is_active ? 'active' : 'inactive'} />
                  {ratings && ratings.count > 0 && (
                    <StarRating value={ratings.average} count={ratings.count} size={14} />
                  )}
                </div>
              </div>
            </div>
            <InfoRow label="Student ID" value={user.student_id} />
            <InfoRow label="Department" value={user.department} />
            <InfoRow label="Batch" value={user.batch} />
            <InfoRow label="Section" value={user.section} />
            <InfoRow label="Phone" value={user.phone} />
          </div>

          {/* Account Card */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Account Info</div>
            <InfoRow label="Role" value={<Badge label={user.role} />} />
            <InfoRow label="Email verified" value={<Badge label={user.is_email_verified ? 'Verified' : 'Unverified'} color={user.is_email_verified ? 'green' : 'amber'} />} />
            <InfoRow label="Approved" value={<Badge label={user.is_approved ? 'Approved' : 'Pending'} color={user.is_approved ? 'green' : 'amber'} />} />
            <InfoRow label="Active" value={<Badge label={user.is_active ? 'Active' : 'Inactive'} color={user.is_active ? 'green' : 'red'} />} />
            <InfoRow label="Member since" value={user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'} />

            {/* Admin: change role */}
            {isAdmin && !isSelf && (
              <div style={{
                marginTop: 18,
                padding: 14,
                background: 'rgba(168,85,247,0.06)',
                border: '1px solid rgba(168,85,247,0.25)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Icon name="shield" size={16} color="var(--purple-400)" />
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple-400)' }}>Change Role</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                  Promote or demote this user. Promoting to Organizer auto-approves; promoting to Admin also marks email verified.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="input-field select-field"
                    value={user.role}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === user.role) return;
                      setPendingRole(next);
                    }}
                    style={{ flex: 1, minWidth: 200 }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {isSelf && isAdmin && (
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                You can't change your own role.
              </div>
            )}
            {user.bio && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Bio</div>
                <p style={{ fontSize: 14, color: 'var(--text-default)', lineHeight: 1.6 }}>{user.bio}</p>
              </div>
            )}
            {user.skills?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {user.skills.map((s) => (
                    <span key={s} className="badge badge-cyan">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <ConfirmModal
          isOpen={!!pendingRole}
          onClose={() => !changingRole && setPendingRole(null)}
          onConfirm={handleConfirmRoleChange}
          title="Change role"
          message={
            pendingRole
              ? `Change ${name}'s role from ${user.role.replace('_', ' ')} to ${pendingRole.replace('_', ' ')}? They'll get the new permissions immediately.`
              : ''
          }
          confirmText={changingRole ? 'Changing…' : 'Change Role'}
          danger={pendingRole === 'ADMIN'}
        />
      </div>
    </>
  );
}
