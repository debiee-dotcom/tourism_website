# LocalTrails dashboard API contract (proposal)

All endpoints below are relative to `window.LocalTrailsConfig.PUBLIC_API_BASE` (default `/api`). The existing backend may use different endpoints: edit `public/js/api.js` to map them. All responses may be arrays or `{data: [...]}`. API writes should return the updated resource or `{data: resource}`. Errors should be `{message:"Description"}` with an appropriate non-2xx HTTP status.

## Auth

`POST /auth/login` body `{email,password}` -> `{token, user: {id,role,providerId}}`. In production, use server-enforced access roles; **do not trust** a frontend `providerId` alone. Demo workspace switching is not authentication.

For authenticated requests, the current adapter attaches `Authorization: Bearer <token>` from sessionStorage or localStorage key `localtrails_token`. Replace with your team's auth scheme if different.

## Resources

| Resource | Endpoints | Important fields |
| --- | --- | --- |
| packages | `GET /packages?providerId=1`, `GET /packages/:id`, `POST /packages`, `PATCH /packages/:id`, `DELETE /packages/:id` | `id,title,destination,category,price,duration,capacity,status,providerId,provider,description` |
| bookings | `GET /bookings?providerId=1`, `GET /bookings/:id`, `PATCH /bookings/:id` | `id,customer,customerId,packageId,package,providerId,date,guests,total,status,payment` |
| providers | `GET /providers`, `GET /providers/:id`, `PATCH /providers/:id` | `id,name,email,location,phone,status,joined` |
| customers | `GET /customers`, `GET /customers/:id`, `PATCH /customers/:id` | `id,name,email,joined,status` |
| availability | `GET /availability`, `GET /availability/:id`, `POST /availability`, `PATCH /availability/:id`, `DELETE /availability/:id` | `id,packageId,date,slots,booked,status` |
| reviews | `GET /reviews?providerId=1`, `GET /reviews/:id`, `PATCH /reviews/:id` | `id,packageId,customer,rating,comment,date,reply` |
| settings | `GET /settings`, `PATCH /settings` | `siteName,supportEmail,bookingFee,maintenance` |

**Status enums:** package: Draft, Pending, Active, Rejected; booking: Pending, Confirmed, Completed, Cancelled; provider: Pending, Approved, Rejected, Suspended; customer: Active, Inactive, Suspended; availability: Open, Closed; payment: Pending, Paid, Refunded, Failed.

## Integration checklist

1. Use real authenticated role/provider ID instead of the demo's hard-coded `providerId:1` in `dashboard.js`.
2. Enforce role checks, resource ownership, status transition rules and validation on the server. Do not allow a provider to access or mutate another provider's records.
3. Adapt API response structures if they differ; ensure all endpoints are same-origin or correctly configured for CORS.
4. Configure `DEMO_MODE:false` and verify every page, filters, CRUD, approvals and profile/settings saves.
5. Replace demo's simple revenue sum with real confirmed/settled payment data for accounting.
6. Never rely on client-side localStorage as a production database.
7. Integrate real sessions, access controls, and route protection. Only provider and admin workspaces are included; no super-admin workspace.
