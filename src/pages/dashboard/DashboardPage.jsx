import useAuthStore from '../../stores/useAuthStore.js';
import AdminDashboard from './AdminDashboard.jsx';
import OrganizerDashboard from './OrganizerDashboard.jsx';
import VolunteerDashboard from './VolunteerDashboard.jsx';
import AttendeeDashboard from './AttendeeDashboard.jsx';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const role = user?.role;

  if (role === 'ADMIN') return <AdminDashboard />;
  if (role === 'ORGANIZER') return <OrganizerDashboard />;
  if (role === 'VOLUNTEER') return <VolunteerDashboard />;
  return <AttendeeDashboard />;
}
