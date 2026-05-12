import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth, RequireGuest, RequireRole } from './router.jsx';

// Layouts
import AuthLayout from './layouts/AuthLayout.jsx';
import AppLayout from './layouts/AppLayout.jsx';

// Auth pages
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import VerifyOtpPage from './pages/auth/VerifyOtpPage.jsx';

// App pages
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import UsersPage from './pages/users/UsersPage.jsx';
import UserDetailPage from './pages/users/UserDetailPage.jsx';
import CreateAdminPage from './pages/users/CreateAdminPage.jsx';
import EventsPage from './pages/events/EventsPage.jsx';
import EventDetailPage from './pages/events/EventDetailPage.jsx';
import CreateEventPage from './pages/events/CreateEventPage.jsx';
import EditEventPage from './pages/events/EditEventPage.jsx';
import ProfilePage from './pages/profile/ProfilePage.jsx';
import MyApplicationsPage from './pages/volunteers/MyApplicationsPage.jsx';
import MyTicketsPage from './pages/tickets/MyTicketsPage.jsx';
import EventManagePage from './pages/events/EventManagePage.jsx';
import FeedbackPage from './pages/feedback/FeedbackPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

// Global UI
import ToastContainer from './components/ui/Toast.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Public OTP verification */}
        <Route path="/verify-otp" element={<AuthLayout />}>
          <Route index element={<VerifyOtpPage />} />
        </Route>

        {/* Guest-only routes */}
        <Route element={<RequireGuest />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
        </Route>

        {/* Protected routes */}
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/events" element={<EventsPage />} />

            {/* Specific event sub-routes must come before :id */}
            <Route element={<RequireRole roles={['ORGANIZER', 'ADMIN']} />}>
              <Route path="/events/create" element={<CreateEventPage />} />
            </Route>

            <Route path="/events/:id" element={<EventDetailPage />} />

            <Route element={<RequireRole roles={['ORGANIZER', 'ADMIN']} />}>
              <Route path="/events/:id/edit" element={<EditEventPage />} />
              <Route path="/events/:id/manage" element={<EventManagePage />} />
            </Route>

            {/* Volunteer routes */}
            <Route element={<RequireRole roles={['VOLUNTEER']} />}>
              <Route path="/my-applications" element={<MyApplicationsPage />} />
            </Route>

            {/* Attendee routes */}
            <Route element={<RequireRole roles={['ATTENDEE']} />}>
              <Route path="/my-tickets" element={<MyTicketsPage />} />
            </Route>

            {/* Shared routes — multiple roles */}
            <Route path="/feedback" element={<FeedbackPage />} />

            {/* Admin only */}
            <Route element={<RequireRole roles={['ADMIN']} />}>
              <Route path="/users/create-admin" element={<CreateAdminPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/users/:id" element={<UserDetailPage />} />
            </Route>
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <ToastContainer />
    </BrowserRouter>
  );
}
