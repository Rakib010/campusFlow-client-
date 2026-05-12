import api from './api.js';

export const dashboardService = {
  adminDashboard: () =>
    api.get('/dashboard/admin').then((r) => r.data),

  organizerDashboard: () =>
    api.get('/dashboard/organizer').then((r) => r.data),

  volunteerDashboard: () =>
    api.get('/dashboard/volunteer').then((r) => r.data),

  attendeeDashboard: () =>
    api.get('/dashboard/attendee').then((r) => r.data),
};
