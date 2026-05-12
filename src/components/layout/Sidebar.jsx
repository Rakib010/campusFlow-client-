import { NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore.js';
import useNotifStore from '../../stores/useNotifStore.js';
import AppLogo from '../ui/AppLogo.jsx';
import Icon from '../ui/Icon.jsx';

const navConfig = {
  ADMIN: [
    {
      section: 'Overview',
      items: [
        { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { to: '/events', icon: 'calendar', label: 'Events' },
      ],
    },
    {
      section: 'Administration',
      items: [
        { to: '/users', icon: 'users', label: 'Users' },
        { to: '/users/create-admin', icon: 'plus', label: 'Create Admin' },
      ],
    },
    {
      section: 'Platform',
      items: [
        { to: '/profile', icon: 'user', label: 'My Profile' },
      ],
    },
  ],
  ORGANIZER: [
    {
      section: 'Overview',
      items: [
        { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { to: '/events', icon: 'calendar', label: 'My Events' },
        { to: '/events/create', icon: 'plus', label: 'Create Event' },
      ],
    },
    {
      section: 'Insights',
      items: [
        { to: '/feedback', icon: 'star', label: 'Feedback & Ratings' },
      ],
    },
    {
      section: 'Tools',
      items: [
        { to: '/profile', icon: 'user', label: 'My Profile' },
      ],
    },
  ],
  VOLUNTEER: [
    {
      section: 'Overview',
      items: [
        { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { to: '/events', icon: 'calendar', label: 'Browse Events' },
        { to: '/my-applications', icon: 'clipboard', label: 'My Applications' },
      ],
    },
    {
      section: 'My Record',
      items: [
        { to: '/feedback', icon: 'star', label: 'My Ratings' },
      ],
    },
    {
      section: 'Account',
      items: [
        { to: '/profile', icon: 'user', label: 'My Profile' },
      ],
    },
  ],
  ATTENDEE: [
    {
      section: 'Overview',
      items: [
        { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { to: '/events', icon: 'calendar', label: 'Browse Events' },
        { to: '/my-tickets', icon: 'ticket', label: 'My Tickets' },
      ],
    },
    {
      section: 'Activity',
      items: [
        { to: '/feedback', icon: 'star', label: 'Feedback' },
      ],
    },
    {
      section: 'Account',
      items: [
        { to: '/profile', icon: 'user', label: 'My Profile' },
      ],
    },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotifStore();
  const navigate = useNavigate();

  const role = user?.role || 'ATTENDEE';
  const sections = navConfig[role] || navConfig.ATTENDEE;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <AppLogo size="md" />
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {sections.map((sec) => (
          <div key={sec.section} className="sidebar-section">
            <div className="sidebar-section-label">{sec.section}</div>
            {sec.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard' || item.to === '/events'}
                className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
              >
                <span className="sidebar-item-icon"><Icon name={item.icon} size={17} /></span>
                <span>{item.label}</span>
                {item.notif && unreadCount > 0 && (
                  <span className="sidebar-item-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Logout pinned at bottom */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(15,23,42,0.06)', flexShrink: 0 }}>
        <button className="sidebar-item" onClick={handleLogout} style={{ width: '100%', color: 'var(--red-400)' }}>
          <span className="sidebar-item-icon" style={{ color: 'var(--red-400)' }}><Icon name="logout" size={17} /></span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
