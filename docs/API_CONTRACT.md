# Milestone 1 — proposed API contract (NOT IMPLEMENTED HERE)

Member 2 must review and agree on endpoint names, session format, role identifiers, permitted fields and query scoping **before integration**. Browser API calls are real requests, without mock data; a missing API returns an error.

## GET /api/auth/me
Authenticated with an HttpOnly, Secure (HTTPS deployment), SameSite cookie. `credentials: same-origin` is used by the front end.

Illustrative **shape only** (not real records):

```json
{"user":{"user_id":"<database-user-id>","name":"<authenticated-name>","role":"provider","status":"active"},"permissions":[]}
```

Roles should be normalized to `customer`, `provider`, `admin`, `super_admin` (or adapt the mapping in `dashboard-core.js`). `local_tourist` and `superadmin` are accepted aliases currently. On unauthenticated sessions return HTTP 401; on forbidden roles/status return HTTP 403. Do not return user.password or password hashes. Never determine identity/role from query parameters or browser local storage. The browser check is only a user experience enhancement, **not a security boundary**.

## GET /api/provider/dashboard
Must return *only* data for the provider identified by the trusted server-side session. Never accept provider_id from the request. Example shape with field type placeholders:

```json
{
  "stats":{"total_packages":0,"total_bookings":0,"pending_bookings":0,"total_revenue":0},
  "recent_bookings":[]
}
```

`total_revenue` and `total_amount` are numeric INR amounts. Define revenue recognition policy with team (e.g. successful paid bookings net of refunds). `pending_bookings` derives from booking_status, not payment_status. `recent_bookings` rows: `booking_id`, `customer_name`, `package_title`, `travel_date` (ISO `YYYY-MM-DD`), `total_amount` (number), `booking_status` (string). Join `tour_packages.provider_id` with authenticated user ID; bookings join by package and `package_availability` for the travel date. Only show customer information needed for booking management.

## GET /api/admin/dashboard
Requires authenticated `admin` or `super_admin`, plus appropriate read permission for admins (settle exact permission key with Member 2). Example shape with zero counts as **schema examples only**, not UI mock values:

```json
{
  "stats":{"pending_packages":0,"total_providers":0,"total_bookings":0,"total_revenue":0},
  "recent_bookings":[]
}
```

`recent_bookings` fields match the provider rows above, but access is platform-wide. Do not expose customer sensitive fields beyond needed views. Server must apply admin permission checks to requested data. `super_admin` has all admin privileges according to the assignment.

## Error responses

Return JSON and HTTP status matching the failure:

- 401 not authenticated: `{"error":"Authentication required"}`
- 403 insufficient role/permission: `{"error":"Forbidden"}`
- 500 server/database issue: `{"error":"Internal server error"}` (do not leak SQL/stack traces)

## Schema mapping from the assignment

- `users(user_id, name, email, password, mobile, role, status, created_at)`
- `tour_packages(package_id, provider_id, destination_id, category_id, title, description, duration_days, price, capacity, image, status, created_at)`
- `package_itinerary(itinerary_id, package_id, day_no, title, description)`
- `package_availability(availability_id, package_id, available_date, seats_available, status)`
- `bookings(booking_id, customer_id, package_id, availability_id, travelers, total_amount, booking_status, payment_status, booked_at)`
- `payments`, `reviews`, `admin_permissions`, `system_logs`, `destinations`, `categories`, `addresses` also required later.

Assignment requires package **inclusions and exclusions**, but these do not appear in the listed `tour_packages` fields. Coordinate a database extension or related table with Member 2; never silently drop them. Booking and payment status must be independent. Availability seats are per date rather than one global value. Do not use undocumented schema changes without team agreement.

## Planned endpoints for later milestones (NOT implemented)

| Area | Suggested contract (confirm with Member 2) |
|---|---|
| Provider packages | `GET/POST /api/provider/packages`, `GET/PUT/DELETE /api/provider/packages/:id` |
| Availability | `GET/POST /api/provider/packages/:id/availability`, `PUT/DELETE /api/provider/availability/:id` |
| Itinerary | `GET/POST /api/provider/packages/:id/itinerary`, `PUT/DELETE /api/provider/itinerary/:id` |
| Provider bookings | `GET /api/provider/bookings`, `PATCH /api/provider/bookings/:id/status` |
| Provider earnings/reviews | `GET /api/provider/reports`, `GET /api/provider/reviews` |
| Admin submissions | `GET /api/admin/packages?status=pending`, `PATCH /api/admin/packages/:id/moderation` |
| Admin provider approvals | `GET /api/admin/providers`, `PATCH /api/admin/providers/:id/status` |
| Admin users | `GET /api/admin/users`, `PATCH /api/admin/users/:id/status` |
| Destinations/categories | CRUD `/api/admin/destinations` and `/api/admin/categories` |
| Admin bookings/issues | `GET /api/admin/bookings`, `PATCH /api/admin/bookings/:id` |
| Reports/activity | `GET /api/admin/reports`, `GET /api/admin/logs` (permission checked) |
| Super admins | CRUD `/api/superadmin/admins`, `PUT /api/superadmin/admins/:id/permissions` |
| Super admin logs/settings | `GET /api/superadmin/logs`, `GET/PUT /api/superadmin/settings` |

All mutating endpoints require server-side validation, parameterized SQL, authenticated roles, permission checks, CSRF protection if cookie-based auth is used, and resource ownership checks. Changes in `admin_permissions` should take effect server-side; UI button hiding is not authorization. Deleting an item with bookings must honor database referential integrity and team business rules.
