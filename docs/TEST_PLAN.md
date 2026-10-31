# Milestone 1 test plan

## A. Automated static check
Run `node tests/static-check.js` from inside this ZIP's root. It checks both HTML pages, asset paths and API bindings. This is not a browser or live backend test.

## B. Browser visual/interaction tests
1. `node tools/preview-server.js`, then open both dashboard URLs.
2. Confirm light-green theme, cards, table, sidebar, semantic headings and quick-action buttons.
3. Confirm that no fabricated statistics, customers or bookings are displayed.
4. Preview intentionally responds `503` on API paths; verify a visible error notice, dashes for metrics, an empty-state table and working Refresh button.
5. Check widths 1440px, 1024px, 768px, 390px and 320px with browser responsive mode. Mobile menu opens, Escape or backdrop closes it. Horizontal scroll is restricted to the booking table.
6. Tab through interactive elements; focus indicator is visible. Future pages are clearly disabled and cannot navigate.
7. Use browser developer tools Network tab to verify fetch requests for `/api/auth/me` and, once authenticated with backend, `/api/provider/dashboard` or `/api/admin/dashboard`.

## C. Integration tests **when Member 2's backend exists**
1. Unauthenticated request for either dashboard API returns 401; browser shows sign-in link.
2. Customer cannot access provider/admin endpoints (403).
3. Provider A must not see provider B's packages or bookings; server checks trusted session, not a supplied provider_id.
4. Provider response contains exactly the relevant packages/bookings, including distinct booking_status and payment_status in storage.
5. Admin without required permission cannot read the protected platform dashboard (403), if such a granular read restriction is specified.
6. Super Admin can access admin dashboard, subject to agreed role spelling.
7. Empty dataset (`recent_bookings: []`, valid numeric zeroes) renders zeros and a clear empty row.
8. Failed MySQL/API response (500), invalid JSON or offline connection renders an error, never made-up metrics.
9. Confirm booking date/time semantics, currency, revenue recognition, and no personal data beyond customer name in summaries.

## D. Later-milestone regression tests (not in this ZIP)
- Package create validates required fields, inclusions/exclusions, date-specific availability and itinerary.
- Provider edits/deletes only own packages; approval status pending/approved/rejected.
- Provider booking confirmation/cancellation obeys state transitions and server ownership checks.
- Admin can approve/reject provider and package; rejection requires reason; manage destinations/categories and user blocks.
- Super Admin changes admin permissions; ordinary admins cannot grant themselves privileges.
- Activity logs and reports are permission filtered; payment state is distinct from booking state.

## Sign-off
Record browser, viewport widths, role ID, response status, API version, test result and screenshots in your team's issue/PR before merging. Automated backend integration and cross-role checks cannot be marked PASSED until the real server exists.
