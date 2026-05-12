import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { PageSpinner } from '../../components/ui/Spinner.jsx';
import { dashboardService } from '../../services/dashboard.service.js';
import useAuthStore from '../../stores/useAuthStore.js';
import Icon from '../../components/ui/Icon.jsx';
import { ChartCard, PieBreakdown, AreaTrend, CHART_COLORS } from '../../components/ui/Charts.jsx';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    dashboardService.adminDashboard()
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const fullName = user?.fullName || user?.full_name || user?.email?.split('@')[0] || 'Admin';

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div className="page-header">
          <div>
            <div className="page-title">Dashboard</div>
            <div className="page-subtitle">{greeting}, {fullName}</div>
          </div>
        </div>
        {loading && <PageSpinner />}
        {error && (
          <div className="auth-error">
            <Icon name="warning" size={16} /> {error}
          </div>
        )}

        {data && (
          <>
            {/* Stats — using actual API shape: data.users.total, data.events.total, etc. */}
            <div className="stats-grid">
              <StatCard
                icon={<Icon name="users" size={22} />}
                label="Total Users"
                value={Number(data.users?.total ?? 0).toLocaleString()}
                color="cyan"
              />
              <StatCard
                icon={<Icon name="calendar" size={22} />}
                label="Total Events"
                value={Number(data.events?.total ?? 0).toLocaleString()}
                color="green"
              />
              <StatCard
                icon={<Icon name="ticket" size={22} />}
                label="Tickets Sold"
                value={Number(data.tickets?.total_tickets ?? 0).toLocaleString()}
                color="amber"
              />
              <StatCard
                icon={<Icon name="award" size={22} />}
                label="Volunteers"
                value={Number(data.users?.volunteers ?? 0).toLocaleString()}
                color="green"
              />
              <StatCard
                icon={<Icon name="clock" size={22} />}
                label="Pending Approvals"
                value={Number(data.users?.pending_organizers ?? 0)}
                color={Number(data.users?.pending_organizers) > 0 ? 'amber' : 'cyan'}
                sub={Number(data.users?.pending_organizers) > 0 ? 'Organizers awaiting approval' : undefined}
              />
              <StatCard
                icon={<Icon name="trophy" size={22} />}
                label="Revenue"
                value={`${Number(data.revenue ?? 0).toFixed(2)} ৳`}
                color="amber"
              />
            </div>

            {/* System-wide metrics */}
            <div className="card" style={{ marginBottom: 24, borderColor: 'rgba(168,85,247,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon name="shield" size={18} color="var(--purple-400)" />
                <div className="card-title" style={{ margin: 0, color: 'var(--purple-400)' }}>System Metrics</div>
              </div>
              <div className="card-subtitle" style={{ marginBottom: 18 }}>
                Platform-wide stats
              </div>

              <div className="stats-grid" style={{ marginBottom: 18 }}>
                <StatCard icon={<Icon name="users" size={22} />}     label="Active Users"        value={data.active_users}                                          color="cyan" />
                <StatCard icon={<Icon name="spark" size={22} />}      label="Signups (30d)"       value={data.signups_30d}                                           color="green" />
                <StatCard icon={<Icon name="trophy" size={22} />}     label="Revenue (30d)"       value={`${Number(data.revenue_30d).toFixed(2)} ৳`}                  color="amber" />
                <StatCard icon={<Icon name="checkCircle" size={22} />} label="Attendance Rate"    value={`${data.attendance_rate}%`} sub={`${data.checked_in_tickets} of ${data.confirmed_tickets} tickets`} color="green" />
                <StatCard icon={<Icon name="shield" size={22} />}     label="Admins"              value={data.admin_count} color="purple" />
              </div>

              {/* Top organizers */}
              {data.top_organizers?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10 }}>
                    Top Organizers · by event count
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>#</th><th>Organizer</th><th>Email</th><th style={{ textAlign: 'right' }}>Events</th></tr>
                      </thead>
                      <tbody>
                        {data.top_organizers.map((o, i) => (
                          <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/users/${o.id}`)}>
                            <td style={{ width: 30, color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{o.full_name || '—'}</td>
                            <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{o.email}</td>
                            <td style={{ textAlign: 'right' }}>
                              <Badge label={`${o.event_count}`} color="cyan" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Charts grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
              {/* Event status pie */}
              {data.events && (() => {
                const eventsPie = [
                  { name: 'Published', value: parseInt(data.events.published) || 0 },
                  { name: 'Ongoing',   value: parseInt(data.events.ongoing) || 0 },
                  { name: 'Completed', value: parseInt(data.events.completed) || 0 },
                  { name: 'Draft',     value: parseInt(data.events.draft) || 0 },
                  { name: 'Cancelled', value: parseInt(data.events.cancelled) || 0 },
                ].filter((s) => s.value > 0);
                return (
                  <ChartCard title="Event Status" subtitle="Across the platform" empty={eventsPie.length === 0 ? 'No events yet' : null}>
                    <PieBreakdown
                      data={eventsPie}
                      colors={[CHART_COLORS.green, CHART_COLORS.cyan, CHART_COLORS.slate, CHART_COLORS.amber, CHART_COLORS.red]}
                    />
                  </ChartCard>
                );
              })()}

              {/* User role distribution */}
              {data.users && (() => {
                const usersPie = [
                  { name: 'Volunteers', value: parseInt(data.users.volunteers) || 0 },
                  { name: 'Organizers', value: parseInt(data.users.organizers) || 0 },
                  { name: 'Attendees',  value: parseInt(data.users.attendees) || 0 },
                ].filter((s) => s.value > 0);
                return (
                  <ChartCard title="User Distribution" subtitle="By role" empty={usersPie.length === 0 ? 'No users yet' : null}>
                    <PieBreakdown
                      data={usersPie}
                      colors={[CHART_COLORS.green, CHART_COLORS.cyan, CHART_COLORS.amber]}
                    />
                  </ChartCard>
                );
              })()}

              {/* Weekly growth */}
              {data.growth_weekly?.length > 0 && (() => {
                const weekly = data.growth_weekly.map((g) => ({
                  week: new Date(g.week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                  signups: g.count,
                }));
                return (
                  <ChartCard title="User Growth" subtitle="New signups · last 8 weeks">
                    <AreaTrend data={weekly} xKey="week" yKey="signups" color={CHART_COLORS.purple} valueLabel="Signups" />
                  </ChartCard>
                );
              })()}
            </div>

            {/* Recent Events */}
            {data.recentEvents?.length > 0 ? (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Recent Events</div>
                    <div className="card-subtitle">Latest activity on the platform</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/events')}>View all</button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentEvents.map((ev) => (
                        <tr key={ev.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/events/${ev.id}`)}>
                          <td>
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{ev.title}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{ev.location || 'No location'}</div>
                          </td>
                          <td><Badge label={ev.status} /></td>
                          <td>{fmtDate(ev.start_date)}</td>
                          <td><span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{ev.category || '—'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Events</div>
                    <div className="card-subtitle">No events yet</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate('/events/create')}>Create event</button>
                </div>
                <div className="empty-state">
                  <div className="empty-state-icon" style={{ color: 'var(--text-muted)' }}><Icon name="calendar" size={40} strokeWidth={1.4} /></div>
                  <div className="empty-state-title">No events on the platform yet</div>
                  <div className="empty-state-desc">Organizers will create events once their accounts are approved.</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
