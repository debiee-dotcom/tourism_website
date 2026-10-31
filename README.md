# LocalTrails — Member 3 — Milestone 1

**Scope:** Provider dashboard and Admin dashboard layouts, shared light-green CSS, DOM updates, responsive navigation, API integration hooks and error handling. This is **Milestone 1 only** of the requested seven-milestone build. No fake data, static user records, MySQL connection, authentication bypass, placeholder CRUD actions or backend endpoints are included.

## Project tree

```text
public/
  provider/dashboard.html
  admin/dashboard.html
  css/dashboard.css
  js/dashboard-core.js
tools/preview-server.js   # standalone static visual preview; not the team's API server
tests/static-check.js
docs/API_CONTRACT.md
docs/TEST_PLAN.md
docs/ASSIGNMENT_COVERAGE.md
```

## Use in existing GitHub repository

1. Switch to branch `feature/provider-admin` (commands below). Verify current team files and resolve path collisions before copying anything.
2. Copy **only** this ZIP's `public/provider/dashboard.html`, `public/admin/dashboard.html`, `public/css/dashboard.css`, and `public/js/dashboard-core.js` into the team repo's `public/` directory. Files in this ZIP are newly scoped Member 3 files; **do not overwrite** any existing files with the same names without reviewing differences.
3. If the existing HTML login route is `/public/login.html` rather than `/login.html`, update the HTML `data-login-path` or coordinate with Member 1. Also check that Member 2's static server serves `/provider/dashboard.html`, not `/public/provider/dashboard.html`.
4. Inspect and align API paths, response formats and session cookies in `docs/API_CONTRACT.md`. If Member 2 uses a different contract, update only the JS integration adapter in `dashboard-core.js`.
5. Do not copy `tools/preview-server.js` into or replace Member 2's server. It is only a helper for visual testing and returns HTTP 503 for `/api/...`.

## Visual preview (before backend APIs exist)

From the unzipped folder:

```bash
node tests/static-check.js
node tools/preview-server.js
```

Open:
- http://localhost:4173/provider/dashboard.html
- http://localhost:4173/admin/dashboard.html

The design should render, responsive navigation and Refresh should work, but the dashboard will **correctly display an API error**, because no authenticated backend is connected. A `503` is an intentional preview response, not a bug. Numbers remain dashes instead of fake figures.

## Running with the team's backend

Start the existing team Node.js server using Member 2's documented command. Open dashboard URLs through that same origin, sign in through Member 1's genuine login, and verify the three suggested GET endpoints. Do not open files as `file://`. No `npm install` is required for this milestone.

## Git: after tests pass

```bash
# Run inside the actual TEAM repository root, not the ZIP folder
 git status
 git switch feature/provider-admin || git switch -c feature/provider-admin
 # Copy the FOUR public/ files above into the team repository first
 node tests/static-check.js  # only if you also copied tests/ or execute from ZIP folder
 git status
 git add public/provider/dashboard.html public/admin/dashboard.html public/css/dashboard.css public/js/dashboard-core.js
 git diff --cached --stat
 git diff --cached --check
 git commit -m "feat: create provider and admin dashboard layouts"
 git push -u origin feature/provider-admin
```

Open a **draft pull request** from `feature/provider-admin` to the team's agreed integration branch after milestone 1 testing so team members can review UI/API contracts. Convert to ready for review when integrated against real backend API behavior; avoid merging until role-scoping and regression tests pass. If the branch already exists locally, `git switch` suffices. Do not stage colleagues' files.

## Notes

- Navigation items for future milestones are intentionally disabled rather than dead links.
- `data-role` selects dashboard UI, not authority. Authorization must happen on Member 2's server.
- Render uses `textContent` and DOM nodes, never unsanitized server HTML.
- Money displays INR; confirm currency and paid-revenue calculations with your team.
- API requires same-origin cookie session; align with Member 2 if they use a different secure strategy.
