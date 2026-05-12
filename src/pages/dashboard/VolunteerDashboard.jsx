import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import StarRating from '../../components/ui/StarRating.jsx';
import { PageSpinner } from '../../components/ui/Spinner.jsx';
import { dashboardService } from '../../services/dashboard.service.js';
import Icon from '../../components/ui/Icon.jsx';
import { ChartCard, AreaTrend, PieBreakdown, BarSeries, CHART_COLORS } from '../../components/ui/Charts.jsx';

const fmtMonth = (d) => new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

export default function VolunteerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    dashboardService.volunteerDashboard()
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (<><Topbar /><div className="page-content"><PageSpinner /></div></>);
  if (!data) return (<><Topbar /><div className="page-content">Failed to load dashboard.</div></>);

  const apps = data.applications || {};
  const monthlyHours = (data.monthlyHours || []).map((m) => ({ month: fmtMonth(m.month), hours: m.hours }));
  const monthlyApplications = (data.monthlyApplications || []).map((m) => ({ month: fmtMonth(m.month), count: m.count }));
  const applicationPie = [
    { name: 'Approved', value: parseInt(apps.approved) || 0 },
    { name: 'Pending',  value: parseInt(apps.pending) || 0 },
    { name: 'Rejected', value: parseInt(apps.rejected) || 0 },
  ].filter((s) => s.value > 0);

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div className="page-header">
          <div>
            <div className="page-title">Dashboard</div>
            <div className="page-subtitle">Your volunteer journey at a glance</div>
          </div>
        </div>

        {/* Top stats */}
        <div className="stats-grid">
          <StatCard icon={<Icon name="clipboard" size={22} />} label="Applications" value={apps.total} color="cyan" />
          <StatCard icon={<Icon name="checkCircle" size={22} />} label="Approved" value={apps.approved} color="green" />
          <StatCard icon={<Icon name="clock" size={22} />} label="Volunteer Hours" value={data.totalHours?.toFixed(1) || '0.0'} color="amber" />
          <StatCard
            icon={<Icon name="star" size={22} />}
            label="Avg Rating"
            value={data.averageRating > 0 ? data.averageRating.toFixed(1) : '—'}
            sub={data.totalRatings > 0 ? `${data.totalRatings} ratings` : 'No ratings yet'}
            color="amber"
          />
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 24 }}>

          <ChartCard
            title="Hours Volunteered"
            subtitle="Last 6 months"
            empty={monthlyHours.length === 0 ? 'No volunteer hours logged yet' : null}
          >
            <AreaTrend data={monthlyHours} xKey="month" yKey="hours" color={CHART_COLORS.amber} valueLabel="Hours" />
          </ChartCard>

          <ChartCard
            title="Applications Over Time"
            subtitle="Last 6 months"
            empty={monthlyApplications.length === 0 ? 'No applications yet' : null}
          >
            <BarSeries data={monthlyApplications} xKey="month" yKey="count" color={CHART_COLORS.cyan} valueLabel="Apps" />
          </ChartCard>

          <ChartCard
            title="Application Status"
            subtitle="All time"
            empty={applicationPie.length === 0 ? 'No applications yet' : null}
          >
            <PieBreakdown
              data={applicationPie}
              colors={[CHART_COLORS.green, CHART_COLORS.amber, CHART_COLORS.red]}
            />
          </ChartCard>

          <ChartCard
            title="Your Rating"
            subtitle={data.totalRatings > 0 ? `Based on ${data.totalRatings} reviews` : 'Earn ratings by volunteering'}
            empty={data.totalRatings === 0 ? 'No ratings yet — your first event will earn one' : null}
            height={240}
          >
            {data.totalRatings > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                <div style={{ fontSize: 64, fontWeight: 700, color: CHART_COLORS.amber, fontFamily: 'monospace', lineHeight: 1 }}>
                  {data.averageRating.toFixed(1)}
                </div>
                <StarRating value={data.averageRating} size={28} showValue={false} />
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  out of 5.0 · {data.totalRatings} {data.totalRatings === 1 ? 'review' : 'reviews'}
                </div>
              </div>
            )}
          </ChartCard>
        </div>

        {/* Recent activity */}
        {data.recentActivity?.length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <div className="card-title">Recent Activity</div>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/my-applications')}>View all</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.recentActivity.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.event_title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Applied {new Date(a.applied_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`badge badge-${a.status === 'approved' ? 'green' : a.status === 'rejected' ? 'red' : 'amber'}`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
