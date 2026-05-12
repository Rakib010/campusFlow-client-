import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/auth.service.js';
import useToastStore from '../../stores/useToastStore.js';
import { Spinner } from '../../components/ui/Spinner.jsx';
import AppLogo from '../../components/ui/AppLogo.jsx';
import Icon from '../../components/ui/Icon.jsx';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const toast = useToastStore();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="auth-card">
        <div className="auth-logo">
          <AppLogo size="lg" />
        </div>
        <h1 className="auth-title">Invalid reset link</h1>
        <p className="auth-subtitle">This link is missing a reset token. Please request a new one.</p>
        <div className="auth-footer">
          <Link to="/forgot-password">Request a new link</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
      toast.success('Password updated. You can now sign in.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset link is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="auth-card">
        <div className="auth-logo">
          <AppLogo size="lg" />
        </div>
        <h1 className="auth-title">Password updated</h1>
        <p className="auth-subtitle">You can now sign in with your new password.</p>
        <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 16px',
            background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#10b981',
          }}>
            <Icon name="checkCircle" size={28} strokeWidth={1.6} />
          </div>
          <button className="btn btn-primary btn-full btn-lg" onClick={() => navigate('/login')}>
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-logo">
        <AppLogo size="lg" />
      </div>

      <h1 className="auth-title">Set a new password</h1>
      <p className="auth-subtitle">Choose a strong password with at least 8 characters.</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="input-wrap">
          <label className="input-label" htmlFor="password">New password</label>
          <div className="input-icon-wrap has-right-icon">
            <span className="input-icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <span className="input-icon-right" onClick={() => setShowPw(!showPw)}>
              {showPw ? (
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </span>
          </div>
        </div>

        <div className="input-wrap">
          <label className="input-label" htmlFor="confirm">Confirm new password</label>
          <div className="input-icon-wrap">
            <span className="input-icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            <input
              id="confirm"
              type={showPw ? 'text' : 'password'}
              className="input-field"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Update password'}
        </button>
      </form>

      <div className="auth-footer">
        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="arrowLeft" size={14} /> Back to login
        </Link>
      </div>
    </div>
  );
}
