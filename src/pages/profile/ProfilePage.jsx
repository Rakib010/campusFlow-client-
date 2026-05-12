import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { PageSpinner, Spinner } from '../../components/ui/Spinner.jsx';
import { usersService } from '../../services/users.service.js';
import { authService } from '../../services/auth.service.js';
import useAuthStore from '../../stores/useAuthStore.js';
import useToastStore from '../../stores/useToastStore.js';

const SKILLS = ['Technical', 'Design', 'Management', 'Marketing', 'Communication', 'Photography', 'Logistics', 'IT Support'];

const isStaff = (role) => role === 'ADMIN';
const isOrganizer = (role) => role === 'ORGANIZER';

export default function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('general');
  const [editSection, setEditSection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const savedForm = useRef({});
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm.current);

  useEffect(() => {
    usersService.getMyProfile()
      .then((r) => {
        setProfile(r.data);
        const initial = {
          fullName: r.data.full_name || '',
          phone: r.data.phone || '',
          bio: r.data.bio || '',
          studentId: r.data.student_id || '',
          batch: r.data.batch || '',
          section: r.data.section || '',
          department: r.data.department || '',
          skills: r.data.skills || [],
        };
        setForm(initial);
        savedForm.current = initial;
      })
      .catch(() => useToastStore.getState().error('Failed to load profile.'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const toggleSkill = (s) => {
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(s) ? f.skills.filter((x) => x !== s) : [...f.skills, s],
    }));
  };

  const handleSaveProfile = useCallback(async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const res = await usersService.updateMyProfile(form);
      setProfile(res.data);
      await fetchMe();
      savedForm.current = { ...form };
      useToastStore.getState().success('Profile updated!');
      setEditSection(null);
    } catch (err) {
      useToastStore.getState().error(err.response?.data?.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  }, [form, fetchMe]);

  // Warn on browser close/refresh
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const pendingNavRef = useRef(null);

  // Intercept sidebar / back-button navigation when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      history.pushState(null, '', window.location.href);
      setShowLeaveModal(true);
    };
    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [isDirty]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { useToastStore.getState().error('Image must be under 5 MB.'); return; }
    try {
      await usersService.uploadPhoto(file);
      useToastStore.getState().success('Photo updated!');
      await fetchMe();
    } catch (err) {
      useToastStore.getState().error(err.response?.data?.message || 'Upload failed.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword.length < 6) { useToastStore.getState().error('New password must be at least 6 characters.'); return; }
    if (pwForm.newPassword !== pwForm.confirm) { useToastStore.getState().error('Passwords do not match.'); return; }
    setPwLoading(true);
    try {
      await authService.changePassword(pwForm.oldPassword, pwForm.newPassword);
      useToastStore.getState().success('Password changed successfully!');
      setPwForm({ oldPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      useToastStore.getState().error(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) return (
    <>
      <Topbar />
      <div className="page-content"><PageSpinner /></div>
    </>
  );

  const role = user?.role || '';
  const name = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const email = user?.email || profile?.email || '';
  const staff = isStaff(role);
  const organizer = isOrganizer(role);

  const toggleEdit = (section) => setEditSection((s) => (s === section ? null : section));
  const val = (v) => v || <span className="profile-muted">—</span>;

  return (
    <>
      <Topbar />

      {/* Unsaved changes banner */}
      {isDirty && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, padding: '12px 20px',
          background: 'var(--bg-card)',
          border: '1px solid rgba(251,191,36,0.40)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          backdropFilter: 'blur(12px)',
          whiteSpace: 'nowrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="warning" size={15} color="var(--amber-400)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber-400)' }}>
              You have unsaved changes
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12 }}
              onClick={() => { setForm({ ...savedForm.current }); setEditSection(null); }}
            >
              Discard
            </button>
            <button
              className="btn btn-primary btn-sm"
              style={{ fontSize: 12 }}
              onClick={handleSaveProfile}
              disabled={saving}
            >
              {saving ? <Spinner size="sm" /> : 'Save now'}
            </button>
          </div>
        </div>
      )}

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 16, padding: '28px 32px',
            maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Icon name="warning" size={20} color="var(--amber-400)" />
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Unsaved changes</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              You have unsaved changes. If you leave now your changes will be lost.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowLeaveModal(false)}>Stay</button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  savedForm.current = { ...form };
                  setShowLeaveModal(false);
                  history.back();
                }}
              >
                Leave anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-content">
        <div className="profile-shell">

          <div className="profile-card">
            {/* Cover banner */}
            <div className="profile-cover" />

            {/* Hero */}
            <div className="profile-hero">
              <div className="profile-photo-wrap">
                <Avatar name={name} src={profile?.photo_url} size="xl" />
                <label className="profile-photo-btn" title="Upload photo">
                  <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                </label>
              </div>
              <div className="profile-hero__meta">
                <div className="profile-hero__name">{name}</div>
                <div className="profile-hero__sub">
                  <span className="profile-hero__email">{email}</span>
                  <Badge label={role} />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="profile-tabs">
              {[
                { key: 'general', label: 'General' },
                { key: 'password', label: 'Password' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`profile-tab${tab === t.key ? ' is-active' : ''}`}
                  onClick={() => { setTab(t.key); setEditSection(null); }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="profile-body">
              {tab === 'general' && (
                <form onSubmit={handleSaveProfile}>
                  <div className="profile-grid">

                    {/* Contact info */}
                    <div className="profile-section">
                      <div className="profile-section__head">
                        <div className="profile-section__title">Contact info</div>
                        <button type="button" className="profile-edit-link" onClick={() => toggleEdit('contact')}>
                          {editSection === 'contact' ? 'Done' : 'Edit'}
                        </button>
                      </div>
                      <div className="profile-kv">
                        <div className="profile-kv-row">
                          <div className="profile-k">Display name</div>
                          <div className="profile-v">
                            {editSection === 'contact'
                              ? <input name="fullName" className="input-field" value={form.fullName} onChange={handleChange} />
                              : val(form.fullName)}
                          </div>
                        </div>
                        <div className="profile-kv-row">
                          <div className="profile-k">Email address</div>
                          <div className="profile-v">{val(email)}</div>
                        </div>
                        <div className="profile-kv-row">
                          <div className="profile-k">Phone number</div>
                          <div className="profile-v">
                            {editSection === 'contact'
                              ? <input name="phone" className="input-field" placeholder="01XXXXXXXXX" value={form.phone} onChange={handleChange} />
                              : val(form.phone)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Personal info — hidden for ADMIN */}
                    {!staff && (
                      <div className="profile-section">
                        <div className="profile-section__head">
                          <div className="profile-section__title">
                            {organizer ? 'Organization info' : 'Academic info'}
                          </div>
                          <button type="button" className="profile-edit-link" onClick={() => toggleEdit('personal')}>
                            {editSection === 'personal' ? 'Done' : 'Edit'}
                          </button>
                        </div>
                        <div className="profile-kv">
                          {!organizer && (
                            <div className="profile-kv-row">
                              <div className="profile-k">Student ID</div>
                              <div className="profile-v">
                                {editSection === 'personal'
                                  ? <input name="studentId" className="input-field" value={form.studentId} onChange={handleChange} />
                                  : val(form.studentId)}
                              </div>
                            </div>
                          )}
                          <div className="profile-kv-row">
                            <div className="profile-k">Department</div>
                            <div className="profile-v">
                              {editSection === 'personal'
                                ? <input name="department" className="input-field" value={form.department} onChange={handleChange} />
                                : val(form.department)}
                            </div>
                          </div>
                          {!organizer && (
                            <>
                              <div className="profile-kv-row">
                                <div className="profile-k">Batch</div>
                                <div className="profile-v">
                                  {editSection === 'personal'
                                    ? <input name="batch" type="number" className="input-field" value={form.batch} onChange={handleChange} />
                                    : val(form.batch)}
                                </div>
                              </div>
                              <div className="profile-kv-row">
                                <div className="profile-k">Section</div>
                                <div className="profile-v">
                                  {editSection === 'personal'
                                    ? <input name="section" className="input-field" value={form.section} onChange={handleChange} />
                                    : val(form.section)}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* About */}
                    <div className={`profile-section${staff ? '' : ''}`}>
                      <div className="profile-section__head">
                        <div className="profile-section__title">About</div>
                        <button type="button" className="profile-edit-link" onClick={() => toggleEdit('about')}>
                          {editSection === 'about' ? 'Done' : 'Edit'}
                        </button>
                      </div>
                      {editSection === 'about'
                        ? <textarea name="bio" className="textarea-field" rows={4} value={form.bio} onChange={handleChange} style={{ resize: 'vertical' }} />
                        : <div className="profile-v" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{val(form.bio)}</div>}
                    </div>

                    {/* Skills — hidden for Admin/Super Admin */}
                    {!staff && (
                      <div className="profile-section">
                        <div className="profile-section__head">
                          <div className="profile-section__title">Skills</div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click to toggle</span>
                        </div>
                        <div className="profile-skill-chips">
                          {SKILLS.map((s) => {
                            const active = form.skills?.includes(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                className={`profile-skill-chip is-editable${active ? ' is-active' : ''}`}
                                onClick={() => toggleSkill(s)}
                              >
                                {s}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>

                </form>
              )}

              {tab === 'password' && (
                <div className="profile-pw-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <Icon name="lock" size={16} color="var(--accent)" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Change password</span>
                  </div>
                  <form onSubmit={handleChangePassword}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div className="input-wrap">
                        <label className="input-label" htmlFor="oldPassword">Current password</label>
                        <input id="oldPassword" type="password" className="input-field" value={pwForm.oldPassword} onChange={(e) => setPwForm((f) => ({ ...f, oldPassword: e.target.value }))} required />
                      </div>
                      <div className="input-wrap">
                        <label className="input-label" htmlFor="newPassword">New password</label>
                        <input id="newPassword" type="password" className="input-field" placeholder="Min. 6 characters" value={pwForm.newPassword} onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))} required />
                      </div>
                      <div className="input-wrap">
                        <label className="input-label" htmlFor="confirm">Confirm new password</label>
                        <input id="confirm" type="password" className="input-field" value={pwForm.confirm} onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} required />
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={pwLoading}>
                          {pwLoading ? <Spinner size="sm" /> : 'Update password'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
