# LocalTrails UI upgrade

## New pages
- `/admin/login.html` — dedicated Admin portal
- `/superadmin/login.html` — dedicated Super Admin portal
- `/admin/dashboard.html`, `/superadmin/dashboard.html`, `/provider/dashboard.html` — restyled dashboards

The dedicated login pages call the existing `/api/auth/login` with `requestedRole`. The backend checks the requested role against the verified user's database role **before creating a session**. It does not create admin accounts or change passwords. Login/logout keep separate role cookies.

## Setup
From the project root, configure `.env`, install dependencies with `npm install`, and run `npm start`. Open the new staff login URLs. Test authentication with real database accounts.

## Tests
1. Log in to `/admin/login.html` as Admin and `/superadmin/login.html` as Super Admin in two tabs; both should remain signed in.
2. Try using an ordinary customer/provider account in either portal: expect HTTP 403, no staff session created.
3. Check that signing out of Admin does not log out Super Admin or Provider.
4. Test Provider > Add package > Availability, Admin > Package approvals, Customer > Booking using connected MySQL data.
5. Test narrow mobile viewport (sidebar open/close and editor form).

Security notes: Separate login pages do not replace server-side role checks. Existing application should receive CSRF protection, persistent sessions, HTTPS, rate limiting, and production payment integration before deploying publicly.
