# Assignment coverage tracker — all 12 minimum requirements

This tracker reflects the uploaded six-page assignment. A checkbox below is **planning**, not a claim of implementation. Current delivery is milestone 1 only.

| # | Requirement | Owner / expected milestone |
|---|---|---|
| 1 | Four roles with server-enforced RBAC | Member 2 auth + Member 3 role views; integration milestone 7 |
| 2 | MySQL relational PK/FK constraints | Member 2 |
| 3 | Built-in Node HTTP backend + REST | Member 2 |
| 4 | AJAX/Fetch and DOM | Member 3 milestone 1 dashboards; whole team |
| 5 | Customer search/filter/book/cancel/history | Member 1 UI; Member 2 APIs |
| 6 | Provider package, availability and booking CRUD | Member 3 milestones 2–4; Member 2 APIs |
| 7 | Destinations/category management | Member 3 milestone 5; Member 2 APIs |
| 8 | Package moderation | Member 3 milestone 5; Member 2 APIs |
| 9 | Payments and reviews | Member 1+2 payment/customer review; Member 3 view provider reviews milestones 4–6 |
| 10 | Reports/customer/provider management | Member 3 milestones 5–6; Member 2 APIs |
| 11 | Super Admin / admin permissions | Member 3 milestone 6; Member 2 APIs |
| 12 | Validation, error handling, responsiveness, logs | Member 3 milestone 1 foundation and later milestones; Member 2 logs |

Permission matrix highlights: Providers can manage *only their own* packages, availability and customer bookings; admins moderate packages and manage providers, users, destinations, bookings, reports; superadmins additionally manage administrators, permissions and system settings. Customers alone may book and cancel eligible bookings. Ordinary admins have limited access to logs/settings subject to permissions.

Schema caution: assignment lists `users`, `addresses`, `destinations`, `categories`, `tour_packages`, `package_itinerary`, `package_availability`, `bookings`, `payments`, `reviews`, `admin_permissions` and `system_logs`. The functional brief calls for inclusions/exclusions even though these fields are not listed in the `tour_packages` columns; Member 2 must resolve the schema gap with team approval.
