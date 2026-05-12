import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/auth.service.js';
import useToastStore from '../../stores/useToastStore.js';
import { Spinner } from '../../components/ui/Spinner.jsx';
import AppLogo from '../../components/ui/AppLogo.jsx';
import Icon from '../../components/ui/Icon.jsx';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const toast = useToastStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { toast.error('Enter your email address.'); return; }
    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
      toast.success('Reset link sent if that email is registered.');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-logo">
        <AppLogo size="lg" />
      </div>

      <h1 className="auth-title">Forgot password?</h1>
      <p className="auth-subtitle">Enter your email and we'll send a reset link.</p>

      {sent ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 16px',
            background: 'rgba(34,211,238,0.1)', borderRadius: 'var(--radius-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)',
          }}>
            <Icon name="mailOpen" size={28} strokeWidth={1.6} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            If <strong style={{ color: 'var(--text-default)' }}>{email}</strong> is registered, check your inbox.
          </p>
          <Link to="/login" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', marginTop: 20 }}>Back to login</Link>
        </div>
      ) : (
        <>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-wrap">
              <label className="input-label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? <Spinner size="sm" /> : 'Send reset link'}
            </button>
          </form>

          <div className="auth-footer">
            <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="arrowLeft" size={14} /> Back to login
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
