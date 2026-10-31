# LocalTrails – Admin & Provider dashboards

Framework-free HTML/CSS/JavaScript dashboards with a single API adapter and preview/demo mode.

## Start

```bash
cd localtrails_dashboard
node dev-server.js
```

Visit http://localhost:3000 (choose Admin or Provider). Requires Node.js; no `npm install`.

## Pages

**Provider:** Overview, My Packages, Bookings, Availability, Reviews, Profile.

**Admin:** Overview, Providers, All Packages, All Bookings, Customers, Reports, Settings.

## Backend integration

Change `PUBLIC_API_BASE` in `public/js/config.js` and set `DEMO_MODE: false`. The API client in `public/js/api.js` sends requests using fetch and bearer authorization. Adjust endpoints/data shapes once your backend contract is finalized; see `docs/API_CONTRACT.md`.

*Demo mode* stores edits in browser localStorage. It is meant for UI preview only: no real authentication, payments, file upload, or database persistence.

## Add to existing Git branch

Copy the bundle files into your repository (review before replacing existing files), then:

```bash
git status
git add public/admin public/provider public/css/dashboard.css public/js/dashboard.js public/js/api.js public/js/config.js public/js/demo-data.js dev-server.js
git commit -m "Add complete Admin and Provider dashboard UI"
git push origin feature/provider-admin
```

If a rebase is in progress, **finish or abort it before copying or committing files**.
