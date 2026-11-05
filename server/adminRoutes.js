// LocalTrails - Admin and Super Admin API Routes

const bcrypt = require("bcrypt");

module.exports = function createAdminRoutes({
    db,
    sessions,
    getRequestBody
}) {
    const send = (res, status, body) => {
        res.writeHead(status, {
            "Content-Type": "application/json"
        });
        res.end(JSON.stringify(body));
    };

    const permissions = [
        "manage_providers",
        "manage_customers",
        "manage_packages",
        "manage_destinations",
        "manage_categories",
        "manage_bookings",
        "view_reports"
    ];

    // Record administrative actions
    async function logAction(req, userId, action, description) {
        try {
            const forwardedFor = req.headers["x-forwarded-for"];

            const ipAddress = forwardedFor
                ? String(forwardedFor).split(",")[0].trim()
                : req.socket?.remoteAddress || null;

            await db.query(
                `INSERT INTO system_logs
                (user_id, action, description, ip_address)
                VALUES (?, ?, ?, ?)`,
                [userId || null, action, description, ipAddress]
            );
        } catch (error) {
            console.error("System log error:", error);
        }
    }

    // Get current administrator permissions
    async function getPermissions(userId) {
        const [rows] = await db.query(
            `SELECT permission_name
             FROM admin_permissions
             WHERE admin_id = ?`,
            [userId]
        );

        return rows.map(row => row.permission_name);
    }

    // Permission enforcement
    async function hasPermission(session, permission) {
        if (session.role === "super_admin") {
            return true;
        }

        if (session.role !== "admin") {
            return false;
        }

        const assigned = await getPermissions(session.userId);

        return assigned.includes(permission);
    }

    async function requirePermission(
        req,
        res,
        session,
        permission
    ) {
        const allowed = await hasPermission(session, permission);

        if (!allowed) {
            send(res, 403, {
                success: false,
                message: "You do not have permission to perform this action."
            });

            return false;
        }

        return true;
    }

    return async function handleAdminRoutes(req, res) {
        const url = new URL(req.url, "http://localhost");
        const path = url.pathname;

        if (!path.startsWith("/api/admin/")) {
            return;
        }

        const requestedRole =
            url.searchParams.get("role") || "admin";

        if (!["admin", "super_admin"].includes(requestedRole)) {
            return send(res, 400, {
                message: "Invalid admin role"
            });
        }

        const cookieName =
            requestedRole === "super_admin"
                ? "superAdminSessionId"
                : "adminSessionId";

        const cookie = (req.headers.cookie || "")
            .split(";")
            .map(item => item.trim())
            .find(item => item.startsWith(cookieName + "="));

        const sessionId = cookie
            ? cookie.slice(cookieName.length + 1)
            : null;

        const session = sessionId
            ? sessions.get(sessionId)
            : null;

        if (!session || session.expiresAt <= Date.now()) {
            return send(res, 401, {
                message: "Please log in"
            });
        }

        if (session.role !== requestedRole) {
            return send(res, 403, {
                message: "Admin access required"
            });
        }

        try {
            // Verify account status from database
            const [users] = await db.query(
                `SELECT role, status
                 FROM users
                 WHERE user_id = ?`,
                [session.userId]
            );

            if (
                !users.length ||
                users[0].role !== session.role ||
                users[0].status !== "active"
            ) {
                sessions.delete(sessionId);

                return send(res, 403, {
                    message: "Admin account is not active"
                });
            }

            // --------------------------------------------------
            // OVERVIEW
            // --------------------------------------------------

            if (
                req.method === "GET" &&
                path === "/api/admin/overview"
            ) {
                const [[customers]] = await db.query(
                    `SELECT COUNT(*) AS customers
                     FROM users
                     WHERE role = 'customer'`
                );

                const [[providers]] = await db.query(
                    `SELECT
                        COUNT(*) AS providers,
                        COALESCE(SUM(status = 'pending'), 0)
                            AS pending_providers
                     FROM users
                     WHERE role = 'provider'`
                );

                const [[packages]] = await db.query(
                    `SELECT
                        COUNT(*) AS packages,
                        COALESCE(SUM(status = 'pending'), 0)
                            AS pending_packages
                     FROM packages`
                );

                const [[bookings]] = await db.query(
                    `SELECT
                        COUNT(*) AS bookings,
                        COALESCE(SUM(
                            booking_status IN ('pending','confirmed')
                        ), 0) AS active_bookings,
                        COALESCE(SUM(
                            booking_status = 'completed'
                        ), 0) AS completed_bookings,
                        COALESCE(SUM(
                            booking_status = 'cancelled'
                        ), 0) AS cancelled_bookings,
                        COALESCE(SUM(
                            CASE
                                WHEN booking_status != 'cancelled'
                                THEN total_amount
                                ELSE 0
                            END
                        ), 0) AS booked_value
                     FROM bookings`
                );

                return send(res, 200, {
                    success: true,
                    data: {
                        ...customers,
                        ...providers,
                        ...packages,
                        ...bookings
                    }
                });
            }

            // --------------------------------------------------
            // PROVIDERS
            // --------------------------------------------------

            if (
                req.method === "GET" &&
                path === "/api/admin/providers"
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_providers"
                )) return;

                const [rows] = await db.query(
                    `SELECT
                        user_id AS id,
                        name,
                        email,
                        mobile,
                        status,
                        created_at
                     FROM users
                     WHERE role = 'provider'
                     ORDER BY created_at DESC`
                );

                return send(res, 200, { data: rows });
            }

            if (
                req.method === "PATCH" &&
                /^\/api\/admin\/providers\/\d+$/.test(path)
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_providers"
                )) return;

                const id = Number(path.split("/").pop());
                const { status } = await getRequestBody(req);

                if (!["active", "pending", "rejected", "blocked"].includes(status)) {
                    return send(res, 400, {
                        message: "Invalid provider status"
                    });
                }

                const [result] = await db.query(
                    `UPDATE users
                     SET status = ?
                     WHERE user_id = ? AND role = 'provider'`,
                    [status, id]
                );

                if (!result.affectedRows) {
                    return send(res, 404, {
                        message: "Provider not found"
                    });
                }

                await logAction(
                    req,
                    session.userId,
                    "PROVIDER_STATUS_UPDATED",
                    `Provider ${id} changed to ${status}`
                );

                return send(res, 200, {
                    success: true,
                    message: "Provider updated"
                });
            }

            // --------------------------------------------------
            // CUSTOMERS
            // --------------------------------------------------

            if (
                req.method === "GET" &&
                path === "/api/admin/customers"
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_customers"
                )) return;

                const [rows] = await db.query(
                    `SELECT
                        user_id AS id,
                        name,
                        email,
                        mobile,
                        status,
                        created_at
                     FROM users
                     WHERE role = 'customer'
                     ORDER BY created_at DESC`
                );

                return send(res, 200, { data: rows });
            }

            if (
                req.method === "PATCH" &&
                /^\/api\/admin\/customers\/\d+\/status$/.test(path)
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_customers"
                )) return;

                const id = Number(path.split("/")[4]);
                const { status } = await getRequestBody(req);

                if (!["active", "blocked"].includes(status)) {
                    return send(res, 400, {
                        message: "Invalid customer status"
                    });
                }

                const [result] = await db.query(
                    `UPDATE users
                     SET status = ?
                     WHERE user_id = ? AND role = 'customer'`,
                    [status, id]
                );

                if (!result.affectedRows) {
                    return send(res, 404, {
                        message: "Customer not found"
                    });
                }

                await logAction(
                    req,
                    session.userId,
                    "CUSTOMER_STATUS_UPDATED",
                    `Customer ${id} changed to ${status}`
                );

                return send(res, 200, {
                    success: true,
                    message: "Customer updated"
                });
            }

            // --------------------------------------------------
            // PACKAGES
            // --------------------------------------------------

            if (
                req.method === "GET" &&
                path === "/api/admin/packages"
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_packages"
                )) return;

                const [rows] = await db.query(
                    `SELECT
                        p.package_id AS id,
                        p.title,
                        p.price,
                        p.capacity,
                        p.status,
                        p.duration,
                        d.name AS destination,
                        u.name AS provider
                     FROM packages p
                     LEFT JOIN destinations d
                        ON d.destination_id = p.destination_id
                     LEFT JOIN users u
                        ON u.user_id = p.provider_id
                     ORDER BY p.created_at DESC`
                );

                return send(res, 200, { data: rows });
            }

            if (
                req.method === "PATCH" &&
                /^\/api\/admin\/packages\/\d+$/.test(path)
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_packages"
                )) return;

                const id = Number(path.split("/").pop());
                const { status } = await getRequestBody(req);

                if (!["active", "pending", "rejected", "disabled"].includes(status)) {
                    return send(res, 400, {
                        message: "Invalid package status"
                    });
                }

                const [result] = await db.query(
                    `UPDATE packages
                     SET status = ?
                     WHERE package_id = ?`,
                    [status, id]
                );

                if (!result.affectedRows) {
                    return send(res, 404, {
                        message: "Package not found"
                    });
                }

                await logAction(
                    req,
                    session.userId,
                    "PACKAGE_STATUS_UPDATED",
                    `Package ${id} changed to ${status}`
                );

                return send(res, 200, {
                    success: true,
                    message: "Package updated"
                });
            }

            // --------------------------------------------------
            // BOOKINGS
            // --------------------------------------------------

            if (
                req.method === "GET" &&
                path === "/api/admin/bookings"
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_bookings"
                )) return;

                const [rows] = await db.query(
                    `SELECT
                        b.booking_id AS id,
                        b.booking_status AS status,
                        b.total_amount,
                        b.number_of_people,
                        b.booking_date,
                        p.title AS package_title,
                        u.name AS customer
                     FROM bookings b
                     JOIN packages p
                        ON p.package_id = b.package_id
                     JOIN users u
                        ON u.user_id = b.customer_id
                     ORDER BY b.booking_date DESC`
                );

                return send(res, 200, { data: rows });
            }

            if (
                req.method === "PATCH" &&
                /^\/api\/admin\/bookings\/\d+$/.test(path)
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_bookings"
                )) return;

                const id = Number(path.split("/").pop());
                const { status } = await getRequestBody(req);

                if (!["pending", "confirmed", "cancelled", "completed"].includes(status)) {
                    return send(res, 400, {
                        message: "Invalid booking status"
                    });
                }

                const [result] = await db.query(
                    `UPDATE bookings
                     SET booking_status = ?
                     WHERE booking_id = ?`,
                    [status, id]
                );

                if (!result.affectedRows) {
                    return send(res, 404, {
                        message: "Booking not found"
                    });
                }

                await logAction(
                    req,
                    session.userId,
                    "BOOKING_STATUS_UPDATED",
                    `Booking ${id} changed to ${status}`
                );

                return send(res, 200, {
                    success: true,
                    message: "Booking updated"
                });
            }

            // --------------------------------------------------
            // DESTINATIONS
            // --------------------------------------------------

            if (
                req.method === "GET" &&
                path === "/api/admin/destinations"
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_destinations"
                )) return;

                const [rows] = await db.query(
                    `SELECT *
                     FROM destinations
                     ORDER BY name`
                );

                return send(res, 200, {
                    success: true,
                    data: rows
                });
            }

            if (
                req.method === "POST" &&
                path === "/api/admin/destinations"
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_destinations"
                )) return;

                const { name, city, state, country } =
                    await getRequestBody(req);

                if (
                    !name?.trim() ||
                    !city?.trim() ||
                    !state?.trim() ||
                    !country?.trim()
                ) {
                    return send(res, 400, {
                        message: "All destination fields are required"
                    });
                }

                const [result] = await db.query(
                    `INSERT INTO destinations
                    (name, city, state, country, status)
                    VALUES (?, ?, ?, ?, 'active')`,
                    [
                        name.trim(),
                        city.trim(),
                        state.trim(),
                        country.trim()
                    ]
                );

                await logAction(
                    req,
                    session.userId,
                    "DESTINATION_ADDED",
                    `Destination ${name} added`
                );

                return send(res, 201, {
                    success: true,
                    id: result.insertId,
                    message: "Destination added"
                });
            }

            if (
                req.method === "PUT" &&
                /^\/api\/admin\/destinations\/\d+$/.test(path)
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_destinations"
                )) return;

                const id = Number(path.split("/").pop());

                const {
                    name,
                    city,
                    state,
                    country,
                    status
                } = await getRequestBody(req);

                if (
                    !name?.trim() ||
                    !city?.trim() ||
                    !state?.trim() ||
                    !country?.trim() ||
                    !["active", "inactive"].includes(status)
                ) {
                    return send(res, 400, {
                        message: "Invalid destination details"
                    });
                }

                const [result] = await db.query(
                    `UPDATE destinations
                     SET name = ?, city = ?, state = ?,
                         country = ?, status = ?
                     WHERE destination_id = ?`,
                    [
                        name.trim(),
                        city.trim(),
                        state.trim(),
                        country.trim(),
                        status,
                        id
                    ]
                );

                if (!result.affectedRows) {
                    return send(res, 404, {
                        message: "Destination not found"
                    });
                }

                await logAction(
                    req,
                    session.userId,
                    "DESTINATION_UPDATED",
                    `Destination ${id} updated`
                );

                return send(res, 200, {
                    success: true,
                    message: "Destination updated"
                });
            }

            // --------------------------------------------------
            // CATEGORIES
            // --------------------------------------------------

            if (
                req.method === "GET" &&
                path === "/api/admin/categories"
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_categories"
                )) return;

                const [rows] = await db.query(
                    `SELECT *
                     FROM categories
                     ORDER BY name`
                );

                return send(res, 200, {
                    success: true,
                    data: rows
                });
            }

            if (
                req.method === "POST" &&
                path === "/api/admin/categories"
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_categories"
                )) return;

                const { name, description } =
                    await getRequestBody(req);

                if (!name?.trim()) {
                    return send(res, 400, {
                        message: "Category name is required"
                    });
                }

                const [result] = await db.query(
                    `INSERT INTO categories
                    (name, description, status)
                    VALUES (?, ?, 'active')`,
                    [name.trim(), description || null]
                );

                await logAction(
                    req,
                    session.userId,
                    "CATEGORY_ADDED",
                    `Category ${name} added`
                );

                return send(res, 201, {
                    success: true,
                    id: result.insertId,
                    message: "Category added"
                });
            }

            if (
                req.method === "PUT" &&
                /^\/api\/admin\/categories\/\d+$/.test(path)
            ) {
                if (!await requirePermission(
                    req, res, session, "manage_categories"
                )) return;

                const id = Number(path.split("/").pop());

                const { name, description, status } =
                    await getRequestBody(req);

                if (
                    !name?.trim() ||
                    !["active", "inactive"].includes(status)
                ) {
                    return send(res, 400, {
                        message: "Invalid category details"
                    });
                }

                const [result] = await db.query(
                    `UPDATE categories
                     SET name = ?, description = ?, status = ?
                     WHERE category_id = ?`,
                    [
                        name.trim(),
                        description || null,
                        status,
                        id
                    ]
                );

                if (!result.affectedRows) {
                    return send(res, 404, {
                        message: "Category not found"
                    });
                }

                await logAction(
                    req,
                    session.userId,
                    "CATEGORY_UPDATED",
                    `Category ${id} updated`
                );

                return send(res, 200, {
                    success: true,
                    message: "Category updated"
                });
            }

            // --------------------------------------------------
            // REPORTS WITH DATE FILTERS
            // --------------------------------------------------

            if (
                req.method === "GET" &&
                path === "/api/admin/reports"
            ) {
                if (!await requirePermission(
                    req, res, session, "view_reports"
                )) return;

                const from = url.searchParams.get("from");
                const to = url.searchParams.get("to");

                const conditions = [];
                const values = [];

                if (from) {
                    conditions.push("DATE(booking_date) >= ?");
                    values.push(from);
                }

                if (to) {
                    conditions.push("DATE(booking_date) <= ?");
                    values.push(to);
                }

                const where = conditions.length
                    ? "WHERE " + conditions.join(" AND ")
                    : "";

                const [[summary]] = await db.query(
                    `SELECT
                        COUNT(*) AS total_bookings,
                        COALESCE(SUM(
                            booking_status IN ('pending','confirmed')
                        ), 0) AS active_bookings,
                        COALESCE(SUM(
                            booking_status = 'completed'
                        ), 0) AS completed_bookings,
                        COALESCE(SUM(
                            booking_status = 'cancelled'
                        ), 0) AS cancelled_bookings,
                        COALESCE(SUM(
                            CASE
                                WHEN booking_status != 'cancelled'
                                THEN total_amount
                                ELSE 0
                            END
                        ), 0) AS total_booking_value
                     FROM bookings
                     ${where}`,
                    values
                );

                const [monthly] = await db.query(
                    `SELECT
                        DATE_FORMAT(booking_date, '%Y-%m') AS month,
                        COUNT(*) AS bookings,
                        COALESCE(SUM(
                            CASE
                                WHEN booking_status != 'cancelled'
                                THEN total_amount
                                ELSE 0
                            END
                        ), 0) AS revenue
                     FROM bookings
                     ${where}
                     GROUP BY DATE_FORMAT(booking_date, '%Y-%m')
                     ORDER BY month`,
                    values
                );

                return send(res, 200, {
                    success: true,
                    data: {
                        summary,
                        monthly
                    }
                });
            }
// --------------------------------------------------
// SYSTEM LOGS WITH FILTERS
// --------------------------------------------------

if (
    req.method === "GET" &&
    path === "/api/admin/logs"
) {
    const conditions = [];
    const values = [];

    const action = url.searchParams.get("action");
    const userId = url.searchParams.get("user_id");
    const role = url.searchParams.get("role");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (action) {
        conditions.push("l.action = ?");
        values.push(action);
    }

    if (userId) {
        conditions.push("l.user_id = ?");
        values.push(userId);
    }

    if (role) {
        conditions.push("u.role = ?");
        values.push(role);
    }

    if (from) {
        conditions.push("DATE(l.created_at) >= ?");
        values.push(from);
    }

    if (to) {
        conditions.push("DATE(l.created_at) <= ?");
        values.push(to);
    }

    const where = conditions.length
        ? "WHERE " + conditions.join(" AND ")
        : "";

    const [rows] = await db.query(
    `SELECT
        l.log_id,
        l.user_id,
        COALESCE(u.name, u.email, 'Deleted User') AS user_name,
        u.email AS user_email,
        u.role AS user_role,
        l.action,
        l.description,
        l.ip_address,
        l.created_at
     FROM system_logs l
     LEFT JOIN users u
        ON u.user_id = l.user_id
     ${where}
     ORDER BY l.created_at DESC
     LIMIT 200`,
    values
);

    return send(res, 200, {
        success: true,
        data: rows
    });
}
// --------------------------------------------------
// SUPER ADMIN: LIST ADMINISTRATORS
// --------------------------------------------------

if (
    req.method === "GET" &&
    path === "/api/admin/admins"
) {
    if (session.role !== "super_admin") {
        return send(res, 403, {
            success: false,
            message: "Super Admin access required"
        });
    }

    const [rows] = await db.query(
        `SELECT
            user_id AS id,
            name,
            email,
            mobile,
            status,
            created_at
         FROM users
         WHERE role = 'admin'
         ORDER BY created_at DESC`
    );

    return send(res, 200, {
        success: true,
        data: rows
    });
}
            // --------------------------------------------------
            // SUPER ADMIN: CREATE ADMIN
            // --------------------------------------------------

            if (
                req.method === "POST" &&
                path === "/api/admin/admins"
            ) {
                if (session.role !== "super_admin") {
                    return send(res, 403, {
                        message: "Super Admin access required"
                    });
                }

                const {
                    name,
                    email,
                    mobile,
                    password
                } = await getRequestBody(req);

                if (
                    !name?.trim() ||
                    !email?.trim() ||
                    !password ||
                    password.length < 8
                ) {
                    return send(res, 400, {
                        message: "Name, email and a password of at least 8 characters are required"
                    });
                }

                const normalizedEmail =
                    email.trim().toLowerCase();

                const [existing] = await db.query(
                    "SELECT user_id FROM users WHERE email = ?",
                    [normalizedEmail]
                );

                if (existing.length) {
                    return send(res, 409, {
                        message: "Email already exists"
                    });
                }

                const passwordHash = await bcrypt.hash(
                    password,
                    12
                );

                const [result] = await db.query(
                    `INSERT INTO users
                    (name, email, mobile, password_hash, role, status)
                    VALUES (?, ?, ?, ?, 'admin', 'active')`,
                    [
                        name.trim(),
                        normalizedEmail,
                        mobile || null,
                        passwordHash
                    ]
                );

                await logAction(
                    req,
                    session.userId,
                    "ADMIN_CREATED",
                    `Administrator ${normalizedEmail} created`
                );

                return send(res, 201, {
                    success: true,
                    message: "Administrator created",
                    id: result.insertId
                });
            }

            // --------------------------------------------------
            // SUPER ADMIN: UPDATE ADMIN
            // --------------------------------------------------

            if (
                req.method === "PUT" &&
                /^\/api\/admin\/admins\/\d+$/.test(path)
            ) {
                if (session.role !== "super_admin") {
                    return send(res, 403, {
                        message: "Super Admin access required"
                    });
                }

                const id = Number(path.split("/").pop());

                if (id === Number(session.userId)) {
                    return send(res, 400, {
                        message: "You cannot edit your own administrator account here"
                    });
                }

                const {
                    name,
                    email,
                    mobile,
                    password
                } = await getRequestBody(req);

                if (!name?.trim() || !email?.trim()) {
                    return send(res, 400, {
                        message: "Name and email are required"
                    });
                }

                const [target] = await db.query(
                    `SELECT user_id
                     FROM users
                     WHERE user_id = ? AND role = 'admin'`,
                    [id]
                );

                if (!target.length) {
                    return send(res, 404, {
                        message: "Administrator not found"
                    });
                }

                const [duplicate] = await db.query(
                    `SELECT user_id
                     FROM users
                     WHERE email = ? AND user_id != ?`,
                    [email.trim().toLowerCase(), id]
                );

                if (duplicate.length) {
                    return send(res, 409, {
                        message: "Email already belongs to another account"
                    });
                }

                if (password && password.length < 8) {
                    return send(res, 400, {
                        message: "Password must contain at least 8 characters"
                    });
                }

                if (password) {
                    const passwordHash = await bcrypt.hash(
                        password,
                        12
                    );

                    await db.query(
                        `UPDATE users
                         SET name = ?, email = ?, mobile = ?,
                             password_hash = ?
                         WHERE user_id = ? AND role = 'admin'`,
                        [
                            name.trim(),
                            email.trim().toLowerCase(),
                            mobile || null,
                            passwordHash,
                            id
                        ]
                    );
                } else {
                    await db.query(
                        `UPDATE users
                         SET name = ?, email = ?, mobile = ?
                         WHERE user_id = ? AND role = 'admin'`,
                        [
                            name.trim(),
                            email.trim().toLowerCase(),
                            mobile || null,
                            id
                        ]
                    );
                }

                await logAction(
    req,
    session.userId,
    "ADMIN_UPDATED",
    `Administrator ${name.trim()} (${email.trim().toLowerCase()}) updated`
);

                return send(res, 200, {
                    success: true,
                    message: "Administrator updated"
                });
            }

            // --------------------------------------------------
            // SUPER ADMIN: ACTIVATE / DEACTIVATE ADMIN
            // --------------------------------------------------

            if (
                req.method === "PATCH" &&
                /^\/api\/admin\/admins\/\d+$/.test(path)
            ) {
                if (session.role !== "super_admin") {
                    return send(res, 403, {
                        message: "Super Admin access required"
                    });
                }

                const id = Number(path.split("/").pop());

                if (id === Number(session.userId)) {
                    return send(res, 400, {
                        message: "You cannot deactivate your own account"
                    });
                }

                const { status } = await getRequestBody(req);

                if (!["active", "blocked"].includes(status)) {
                    return send(res, 400, {
                        message: "Invalid administrator status"
                    });
                }

                const [result] = await db.query(
                    `UPDATE users
                     SET status = ?
                     WHERE user_id = ? AND role = 'admin'`,
                    [status, id]
                );

                if (!result.affectedRows) {
                    return send(res, 404, {
                        message: "Administrator not found"
                    });
                }

                await logAction(
                    req,
                    session.userId,
                    "ADMIN_STATUS_UPDATED",
                    `Administrator ${id} changed to ${status}`
                );

                return send(res, 200, {
                    success: true,
                    message: "Administrator status updated"
                });
            }

            // --------------------------------------------------
            // SUPER ADMIN: DELETE ADMIN
            // --------------------------------------------------

            if (
                req.method === "DELETE" &&
                /^\/api\/admin\/admins\/\d+$/.test(path)
            ) {
                if (session.role !== "super_admin") {
                    return send(res, 403, {
                        message: "Super Admin access required"
                    });
                }

                const id = Number(path.split("/").pop());

                if (id === Number(session.userId)) {
                    return send(res, 400, {
                        message: "You cannot delete your own account"
                    });
                }

                const [result] = await db.query(
                    `DELETE FROM users
                     WHERE user_id = ? AND role = 'admin'`,
                    [id]
                );

                if (!result.affectedRows) {
                    return send(res, 404, {
                        message: "Administrator not found"
                    });
                }
               

                await logAction(
                    req,
                    session.userId,
                    "ADMIN_DELETED",
                    `Administrator ${id} deleted`
                );

                return send(res, 200, {
                    success: true,
                    message: "Administrator deleted"
                });
            }

            // --------------------------------------------------
            // SUPER ADMIN: VIEW ADMIN PERMISSIONS
            // --------------------------------------------------

            if (
                req.method === "GET" &&
                /^\/api\/admin\/admins\/\d+\/permissions$/.test(path)
            ) {
                if (session.role !== "super_admin") {
                    return send(res, 403, {
                        message: "Super Admin access required"
                    });
                }

                const id = Number(path.split("/")[4]);

                const [admin] = await db.query(
                    `SELECT user_id
                     FROM users
                     WHERE user_id = ? AND role = 'admin'`,
                    [id]
                );

                if (!admin.length) {
                    return send(res, 404, {
                        message: "Administrator not found"
                    });
                }

                const assigned = await getPermissions(id);

                return send(res, 200, {
                    success: true,
                    data: {
                        available: permissions,
                        assigned
                    }
                });
            }

            // --------------------------------------------------
            // SUPER ADMIN: ASSIGN / UPDATE PERMISSIONS
            // --------------------------------------------------

            if (
                req.method === "PUT" &&
                /^\/api\/admin\/admins\/\d+\/permissions$/.test(path)
            ) {
                if (session.role !== "super_admin") {
                    return send(res, 403, {
                        message: "Super Admin access required"
                    });
                }

                const id = Number(path.split("/")[4]);

                const { permissions: selected } =
                    await getRequestBody(req);

                if (
                    !Array.isArray(selected) ||
                    selected.some(p => !permissions.includes(p)) ||
                    new Set(selected).size !== selected.length
                ) {
                    return send(res, 400, {
                        message: "Invalid permissions list"
                    });
                }

                const [admin] = await db.query(
    `SELECT user_id, name, email
     FROM users
     WHERE user_id = ? AND role = 'admin'`,
    [id]
);

                if (!admin.length) {
                    return send(res, 404, {
                        message: "Administrator not found"
                    });
                }

                await db.query(
                    "DELETE FROM admin_permissions WHERE admin_id = ?",
                    [id]
                );

                for (const permission of selected) {
                    await db.query(
                        `INSERT INTO admin_permissions
                        (admin_id, permission_name)
                        VALUES (?, ?)`,
                        [id, permission]
                    );
                }
        

                await logAction(
    req,
    session.userId,
    "ADMIN_PERMISSIONS_UPDATED",
    `Permissions updated for ${admin[0].name || admin[0].email}`
);

                return send(res, 200, {
                    success: true,
                    message: "Administrator permissions updated"
                });
            }
            // --------------------------------------------------
// SUPER ADMIN: VIEW SYSTEM SETTINGS
// --------------------------------------------------

if (
    req.method === "GET" &&
    path === "/api/admin/settings"
) {
    if (session.role !== "super_admin") {
        return send(res, 403, {
            success: false,
            message: "Super Admin access required"
        });
    }

    const [rows] = await db.query(
        `SELECT
            setting_id,
            setting_key,
            setting_value,
            description,
            updated_by,
            updated_at
         FROM system_settings
         ORDER BY setting_id`
    );

    return send(res, 200, {
        success: true,
        data: rows
    });
}

// --------------------------------------------------
// SUPER ADMIN: UPDATE SYSTEM SETTINGS
// --------------------------------------------------

if (
    req.method === "PUT" &&
    path === "/api/admin/settings"
) {
    if (session.role !== "super_admin") {
        return send(res, 403, {
            success: false,
            message: "Super Admin access required"
        });
    }

    const body = await getRequestBody(req);
    const settings = body.settings;

    if (
        !Array.isArray(settings) ||
        settings.length === 0
    ) {
        return send(res, 400, {
            success: false,
            message: "Settings array is required"
        });
    }

    const allowedKeys = [
        "site_name",
        "booking_enabled",
        "registration_enabled",
        "maintenance_mode",
        "support_email"
    ];

    for (const setting of settings) {
        if (
            !setting.key ||
            !allowedKeys.includes(setting.key) ||
            setting.value === undefined
        ) {
            return send(res, 400, {
                success: false,
                message: "Invalid setting key or value"
            });
        }
    }

    for (const setting of settings) {
        await db.query(
            `UPDATE system_settings
             SET setting_value = ?, updated_by = ?
             WHERE setting_key = ?`,
            [
                String(setting.value),
                session.userId,
                setting.key
            ]
        );
    }

    return send(res, 200, {
        success: true,
        message: "System settings updated successfully"
    });
}

            // --------------------------------------------------
            // UNKNOWN ROUTE
            // --------------------------------------------------

            return send(res, 404, {
                success: false,
                message: "Admin endpoint unavailable"
            });

        } catch (error) {
            console.error("Admin API error:", error);

            return send(res, 500, {
                success: false,
                message: "Admin operation failed. Check server logs."
            });
        }
    };
};