# LocalTrails: combined frontend, backend, and Member 3 dashboards

## What was merged
- Member 2's **updated** backend ZIP (`tourism_website-feature-backend(1).zip`) is the base, including Member 1's existing customer pages.
- Member 3's original dashboard visual style is reused, with a new API-compatible dashboard controller and secure session-based role checks.
- Provider routes are the uploaded Member 2 `server/providerRoutes.js`.
- Added `server/adminRoutes.js` for read-only dashboard lists and explicitly permitted approvals/status updates.
- Added `/api/catalog/options` for database-backed package creation forms.
- Added `/superadmin/dashboard.html` with a limited administrator-status section, not a complete permissions-management system.
- No mock accounts or demo data are shipped.

## Run in VS Code (macOS)
1. Extract the ZIP and **Open Folder** `LocalTrails_Full_Integrated` in VS Code.
2. Make sure Node.js, MySQL 8, and npm are installed. Start your local MySQL service.
3. For a **fresh development database only**, run `mysql -u root -p < database/schema.sql` in the project root.
   **Do not** run the schema blindly on a database with existing data. The uploaded backend's original schema lacked many columns/tables used by its API. Review your teammate's actual production schema/migrations first.
4. Run `cp .env.example .env` and edit `.env` to supply your local MySQL credentials. Never commit `.env`.
5. Run `npm install`, then `npm start`.
6. Open `http://localhost:3000`. Login at `/login.html`.
7. Role pages:
   - Provider: `http://localhost:3000/provider/dashboard.html`
   - Admin: `http://localhost:3000/admin/dashboard.html`
   - Super Admin: `http://localhost:3000/superadmin/dashboard.html`
8. `http://localhost:3000/api/health` confirms the server **and database** connection.

## First-time database setup
- Insert real destinations and categories using MySQL before creating packages, e.g.
  `INSERT INTO destinations(name) VALUES ('Chennai'),('Ooty');`
  `INSERT INTO categories(name) VALUES ('Nature'),('Cultural');`
- Customer accounts register through the website. New provider accounts register with `pending` status and require approval from an existing admin.
- To bootstrap the **first administrator** in a LOCAL development database, register a normal customer account, then use MySQL to promote that account **only if you own that account**:
  `UPDATE users SET role='admin',status='active' WHERE email='your-local-admin@example.com' AND role='customer';`
  Use an authorized process for real deployments, never give role-change ability to public registration or client code.
- Admin login redirects to the admin dashboard; approved provider login redirects to the provider dashboard.

## API integration
- Provider: `GET /api/provider/dashboard`, packages GET/POST/PUT/DELETE, availability GET/POST/PUT, bookings GET/PATCH, reviews GET, earnings GET.
- Admin: `GET /api/admin/overview`, providers GET/PATCH status, packages GET/PATCH status, bookings GET, customers GET, admins GET/PATCH only for super_admin.
- `GET /api/auth/me` and HttpOnly session cookies are shared across pages.
- All database-changing permissions are verified on the server; dashboard role checks are supplementary.
- Provider package updates are sent back to `pending` for review by Member 2's existing backend.

## Known limitations to resolve before production
- Actual MySQL database compatibility has **not** been validated here (no configured local MySQL credentials were supplied). Test end-to-end with real sample accounts/data.
- The backend still uses in-memory session storage: sessions reset when the process restarts and are not suitable for multi-instance deployment.
- Member 2's original payment endpoint uses a **simulated** transaction reference; connect a real payment service before production and do not present it as actual payment processing.
- The admin APIs introduced here are an integration implementation, not yet reviewed by Member 2; have your teammate review and merge them.
- This does not implement the full Super Admin permissions/system-logs UI or all settings/report endpoints.
- The customer's originally uploaded pages may still include development comments/simulated elements; run a user-acceptance review before deployment.
- Database schema is a fresh-install reconstruction from the uploaded API sources and should be reconciled with the actual authoritative schema.
- API response errors, role authorization, booking/payment data integrity, accessibility, and mobile display require integration tests with MySQL.

## Git workflow
This ZIP has no `.git` repository. From your *existing* repository/feature branch, bring over the code carefully and inspect `git diff`. For a safe team integration, open a PR from a dedicated integration branch into the team's integration target; do not overwrite teammates' unmerged changes.

From the extracted folder alone, you can initialize a new Git repository, but **do not `git push --force` or replace the team's shared history**. Prefer cloning your GitHub repo, checking out the feature branch and copying needed files into that clone, followed by a normal PR.
