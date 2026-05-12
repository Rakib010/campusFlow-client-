# CampusFlow Web — University Volunteer Management System

> React + Vite SPA for CampusFlow UVMS — the frontend client that consumes the [CampusFlow API](../CampusFlow.Api/).

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technical Stack](#2-technical-stack)
3. [Project Structure](#3-project-structure)
4. [Routing & Pages](#4-routing--pages)
5. [State Management](#5-state-management)
6. [Styling](#6-styling)
7. [Running the Project](#7-running-the-project)
8. [Environment Variables](#8-environment-variables)
9. [Build & Deploy](#9-build--deploy)

---

## 1. Overview

A single-page React application that delivers role-aware UIs for the four CampusFlow user roles (ADMIN, ORGANIZER, VOLUNTEER, ATTENDEE). The app is desktop-first with a light-mode design system anchored on a purple brand accent.

Brand colors at a glance:
- **Primary**: purple gradient `#8b5cf6 → #a855f7 → #7e22ce`
- **Surface**: white on `#f6f7fb` page background
- **Text**: slate-900 on light surfaces; muted slate-500 for secondary copy

Logo (sidebar, favicon, email) is sourced from a single Cloudinary URL so all surfaces stay in sync.

---

## 2. Technical Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Build tool | Vite 8 |
| Routing | React Router DOM 7 |
| State management | Zustand 5 (auth, toast, notification stores) |
| Server state / cache | TanStack React Query |
| HTTP client | Axios (with auth interceptor + auto refresh-token retry) |
| Styling | Hand-authored CSS in `src/styles/*.css` (no Tailwind / CSS-in-JS) |
| Date picking | `react-datepicker` |
| Charts | Recharts (via local `Charts.jsx` wrappers) |

---

## 3. Project Structure

```
src/
├── App.jsx                  # All routes (RequireAuth / RequireGuest / RequireRole)
├── main.jsx                 # Vite entry point
├── router.jsx               # Auth-guard route helpers
├── layouts/
│   ├── AppLayout.jsx        # Sidebar + Topbar shell for authed pages
│   └── AuthLayout.jsx       # Two-column split for login / register / reset
├── pages/
│   ├── auth/                # LoginPage, RegisterPage, VerifyOtpPage,
│   │                        # ForgotPasswordPage, ResetPasswordPage
│   ├── dashboard/           # DashboardPage (role router) +
│   │                        # AdminDashboard, OrganizerDashboard,
│   │                        # VolunteerDashboard, AttendeeDashboard
│   ├── events/              # EventsPage, EventDetailPage,
│   │                        # CreateEventPage, EditEventPage, EventManagePage
│   ├── feedback/            # FeedbackPage (ratings + leaderboard)
│   ├── profile/             # ProfilePage
│   ├── tickets/             # MyTicketsPage
│   ├── users/               # UsersPage, UserDetailPage, CreateAdminPage
│   ├── volunteers/          # MyApplicationsPage
│   └── NotFoundPage.jsx
├── components/
│   ├── layout/              # Sidebar, Topbar
│   └── ui/                  # AppLogo, Icon, Badge, StatCard, Spinner,
│                            # Modal, Charts, StarRating, Countdown, ...
├── services/                # auth, users, events, tickets, volunteers,
│                            # feedback, dashboard, notifications, paymentMethods,
│                            # certificates, attendance
├── stores/                  # useAuthStore, useToastStore, useNotifStore
└── styles/                  # variables, layout, buttons, inputs, app-logo,
                             # topbar, feedback, ...
```

---

## 4. Routing & Pages

All non-public routes are guarded by `RequireAuth`. Role-restricted routes are wrapped in `RequireRole roles={[...]}`.

| Route | Page | Roles |
|-------|------|-------|
| `/login` | Sign in | Public (guest-only) |
| `/register` | Create account | Public (guest-only) |
| `/forgot-password` | Request reset email | Public (guest-only) |
| `/reset-password?token=…` | Set a new password | Public (guest-only) |
| `/verify-otp` | Email verification (6-digit OTP) | Public |
| `/dashboard` | Role-based dashboard | All authed |
| `/events` | Events list (search, filter, sort) | All authed |
| `/events/:id` | Event detail (gallery, volunteer apply, ticket buy) | All authed |
| `/events/create` | Create event | ORGANIZER, ADMIN |
| `/events/:id/edit` | Edit event | ORGANIZER, ADMIN |
| `/events/:id/manage` | Manage event (volunteers + tickets + attendance tabs) | ORGANIZER, ADMIN |
| `/my-applications` | My volunteer applications | VOLUNTEER |
| `/my-tickets` | My tickets | ATTENDEE |
| `/feedback` | Feedback & Ratings (my ratings for volunteers; volunteer grid + leaderboard for others) | All authed |
| `/users` | User management (filter, sort, kebab actions) | ADMIN |
| `/users/:id` | User detail (role change, activate/deactivate) | ADMIN |
| `/users/create-admin` | Create another admin | ADMIN |
| `/profile` | My profile (cover banner, role-based fields, unsaved-changes guard) | All authed |
| `*` | 404 | — |

> Only one administrative role exists (`ADMIN`). The legacy `SUPER_ADMIN` tier has been consolidated — any admin has full platform access.

---

## 5. State Management

Two layers:

**Zustand stores** (`src/stores/`)
- `useAuthStore` — current user, access token, login/logout, refresh-token retry, `fetchMe`
- `useToastStore` — global toast queue (success / error / info)
- `useNotifStore` — unread badge count, periodic poll, mark-read mutations

**TanStack React Query**
- Used for server cache where it pays off (lists, dashboards).
- Most simpler pages use straight Axios + `useState` / `useEffect` to keep things explicit.

Axios is centralised in `src/services/api.js` with:
- `Authorization: Bearer <token>` injection from `useAuthStore`
- 401 → silent refresh via `/auth/refresh-token` → retry once
- Reject + force logout on refresh failure

---

## 6. Styling

Plain CSS files imported once in `main.jsx`. Tokens live in `src/styles/variables.css`:

```css
--accent: var(--purple-600);            /* #9333ea */
--accent-strong: var(--purple-700);     /* #7e22ce */
--gradient-accent: linear-gradient(135deg, #8b5cf6, #a855f7);
--bg-page: #f6f7fb;
--bg-surface: #ffffff;
--text-primary: var(--slate-900);
--text-muted: var(--slate-500);
--sidebar-width: 260px;
--topbar-height: 64px;
```

Component-level styles are namespaced (e.g. `.fb-*` for Feedback page, `.app-logo__*` for the logo block). Inline `style={...}` is used only for one-off layout tweaks.

---

## 7. Running the Project

```bash
cd CampusFlow.Web
npm install
npm run dev               # http://localhost:5173 (Vite dev server, HMR)
```

The API must be running at the URL configured in `VITE_API_URL` (default `http://localhost:5001/api`).

---

## 8. Environment Variables

Create a `.env` (or `.env.local`) file in `CampusFlow.Web/`:

```env
VITE_API_URL=http://localhost:5001/api
```

Vite injects any var prefixed with `VITE_` into the bundle. Anything else is ignored at build time.

---

## 9. Build & Deploy

```bash
npm run build             # produces dist/
npm run preview           # serves dist/ at http://localhost:4173
```

The `dist/` folder is a static bundle. Host it on any static service (Vercel, Netlify, S3 + CloudFront, Nginx, or `serve dist`).

**Note on assets**: The app logo and favicon both load from Cloudinary — no local image binary is shipped in the build. The PNG URL is hard-coded in `src/components/ui/AppLogo.jsx` (exported as `LOGO_URL`) and in `index.html` for the favicon.
