// Provider API routes for LocalTrails

module.exports = function createProviderRoutes({ db, sessions, getRequestBody }) {

    const send = (res, status, body) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
    };

    // Get logged-in session
    function getSession(req) {
        const cookie = (req.headers.cookie || "")
            .split(";")
            .map(part => part.trim())
            .find(part => part.startsWith("sessionId="));

        if (!cookie) return null;

        const id = cookie.slice("sessionId=".length);
        const session = sessions.get(id);

        if (!session || session.expiresAt < Date.now()) {
            sessions.delete(id);
            return null;
        }

        return session;
    }

    // Verify provider authentication and approval
    async function provider(req, res) {
        const session = getSession(req);

        if (!session) {
            send(res, 401, {
                success: false,
                message: "Please log in first"
            });
            return null;
        }

        if (session.role !== "provider") {
            send(res, 403, {
                success: false,
                message: "Provider access only"
            });
            return null;
        }

        const [rows] = await db.query(
            "SELECT status FROM users WHERE user_id = ? AND role = ?",
            [session.userId, "provider"]
        );

        if (!rows.length || rows[0].status !== "active") {
            send(res, 403, {
                success: false,
                message: "Your provider account is not active"
            });
            return null;
        }

        return session;
    }

    // Verify that a package belongs to the logged-in provider
    async function ownsPackage(packageId, providerId) {
        const [rows] = await db.query(
            "SELECT package_id FROM packages WHERE package_id = ? AND provider_id = ?",
            [packageId, providerId]
        );

        return rows.length > 0;
    }

    return async function handleProviderRoutes(req, res) {

        const url = new URL(req.url, "http://localhost");
        const path = url.pathname;

        if (!path.startsWith("/api/provider/")) return;

        try {
            const session = await provider(req, res);

            if (!session) return;

            const providerId = session.userId;
            let match;

            // =====================================
            // 1. PROVIDER DASHBOARD
            // =====================================

            if (req.method === "GET" && path === "/api/provider/dashboard") {

                const [[packages]] = await db.query(
                    `SELECT
                        COUNT(*) AS total_packages,
                        SUM(status = 'active') AS active_packages,
                        SUM(status = 'pending') AS pending_packages
                     FROM packages
                     WHERE provider_id = ?`,
                    [providerId]
                );

                const [[bookings]] = await db.query(
                    `SELECT
                        COUNT(*) AS total_bookings,
                        COALESCE(
                            SUM(
                                CASE
                                    WHEN booking_status IN ('confirmed', 'completed')
                                    THEN total_amount
                                    ELSE 0
                                END
                            ), 0
                        ) AS revenue
                     FROM bookings b
                     JOIN packages p ON p.package_id = b.package_id
                     WHERE p.provider_id = ?`,
                    [providerId]
                );

                return send(res, 200, {
                    success: true,
                    data: {
                        ...packages,
                        ...bookings
                    }
                });
            }

            // =====================================
            // 2. VIEW OWN PACKAGES
            // =====================================

            if (req.method === "GET" && path === "/api/provider/packages") {

                const [rows] = await db.query(
                    `SELECT
                        p.*,
                        d.name AS destination_name,
                        c.name AS category_name
                     FROM packages p
                     LEFT JOIN destinations d
                        ON d.destination_id = p.destination_id
                     LEFT JOIN categories c
                        ON c.category_id = p.category_id
                     WHERE p.provider_id = ?
                     ORDER BY p.created_at DESC`,
                    [providerId]
                );

                return send(res, 200, {
                    success: true,
                    data: rows
                });
            }

            // =====================================
            // 3. CREATE PACKAGE
            // =====================================

            if (req.method === "POST" && path === "/api/provider/packages") {

                const body = await getRequestBody(req);

                const required = [
                    "title",
                    "destination_id",
                    "category_id",
                    "duration",
                    "price",
                    "capacity"
                ];

                if (required.some(key =>
                    body[key] === undefined ||
                    body[key] === null ||
                    body[key] === ""
                )) {
                    return send(res, 400, {
                        success: false,
                        message: "Please provide title, destination, category, duration, price and capacity"
                    });
                }

                if (
                    Number(body.price) <= 0 ||
                    Number(body.capacity) <= 0 ||
                    Number(body.duration) <= 0
                ) {
                    return send(res, 400, {
                        success: false,
                        message: "Price, duration and capacity must be positive"
                    });
                }

                const [result] = await db.query(
                    `INSERT INTO packages
                    (
                        provider_id,
                        title,
                        destination_id,
                        category_id,
                        duration,
                        price,
                        available_from,
                        badge,
                        image_url,
                        description,
                        capacity,
                        status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        providerId,
                        body.title,
                        body.destination_id,
                        body.category_id,
                        body.duration,
                        body.price,
                        body.available_from || null,
                        body.badge || null,
                        body.image_url || null,
                        body.description || null,
                        body.capacity,
                        "pending"
                    ]
                );

                return send(res, 201, {
                    success: true,
                    message: "Package submitted for admin approval",
                    data: {
                        package_id: result.insertId,
                        status: "pending"
                    }
                });
            }

            // =====================================
            // 4. UPDATE OR DELETE PACKAGE
            // =====================================

            match = path.match(/^\/api\/provider\/packages\/(\d+)$/);

            if (match) {

                const id = Number(match[1]);

                if (!await ownsPackage(id, providerId)) {
                    return send(res, 404, {
                        success: false,
                        message: "Package not found"
                    });
                }

                if (req.method === "PUT") {

                    const body = await getRequestBody(req);

                    const allowed = [
                        "title",
                        "destination_id",
                        "category_id",
                        "duration",
                        "price",
                        "available_from",
                        "badge",
                        "image_url",
                        "description",
                        "capacity"
                    ];

                    const fields = allowed.filter(
                        key => body[key] !== undefined
                    );

                    if (!fields.length) {
                        return send(res, 400, {
                            success: false,
                            message: "No package fields supplied"
                        });
                    }

                    const values = fields.map(key => body[key]);

                    const sql = fields
                        .map(key => `\`${key}\` = ?`)
                        .join(", ");

                    await db.query(
                        `UPDATE packages
                         SET ${sql}, status = 'pending'
                         WHERE package_id = ? AND provider_id = ?`,
                        [...values, id, providerId]
                    );

                    return send(res, 200, {
                        success: true,
                        message: "Package updated and sent for approval"
                    });
                }

                if (req.method === "DELETE") {

                    const [[counts]] = await db.query(
                        "SELECT COUNT(*) AS total FROM bookings WHERE package_id = ?",
                        [id]
                    );

                    if (counts.total > 0) {
                        return send(res, 409, {
                            success: false,
                            message: "Package has bookings and cannot be deleted"
                        });
                    }

                    await db.query(
                        "DELETE FROM packages WHERE package_id = ? AND provider_id = ?",
                        [id, providerId]
                    );

                    return send(res, 200, {
                        success: true,
                        message: "Package deleted"
                    });
                }
            }

            // =====================================
            // 5. PACKAGE MODES
            // =====================================

            match = path.match(/^\/api\/provider\/packages\/(\d+)\/modes$/);

            if (match) {

                const id = Number(match[1]);

                if (!await ownsPackage(id, providerId)) {
                    return send(res, 404, {
                        success: false,
                        message: "Package not found"
                    });
                }

                if (req.method === "GET") {

                    const [rows] = await db.query(
                        "SELECT mode FROM package_modes WHERE package_id = ?",
                        [id]
                    );

                    return send(res, 200, {
                        success: true,
                        data: rows.map(row => row.mode)
                    });
                }

                if (req.method === "PUT") {

                    const body = await getRequestBody(req);
                    const modes = body.modes;

                    const valid = ["tribe", "legends", "eco"];

                    if (
                        !Array.isArray(modes) ||
                        modes.some(mode => !valid.includes(mode)) ||
                        new Set(modes).size !== modes.length
                    ) {
                        return send(res, 400, {
                            success: false,
                            message: "modes must be a unique array containing tribe, legends or eco"
                        });
                    }

                    const conn = await db.getConnection();

                    try {
                        await conn.beginTransaction();

                        await conn.query(
                            "DELETE FROM package_modes WHERE package_id = ?",
                            [id]
                        );

                        for (const mode of modes) {
                            await conn.query(
                                "INSERT INTO package_modes (package_id, mode) VALUES (?, ?)",
                                [id, mode]
                            );
                        }

                        await conn.commit();

                    } catch (error) {
                        await conn.rollback();
                        throw error;

                    } finally {
                        conn.release();
                    }

                    return send(res, 200, {
                        success: true,
                        message: "Package modes updated",
                        data: modes
                    });
                }
            }

            // =====================================
            // 6. VIEW AVAILABILITY
            // =====================================

            if (req.method === "GET" && path === "/api/provider/availability") {

                const [rows] = await db.query(
                    `SELECT a.*, p.title
                     FROM package_availability a
                     JOIN packages p ON p.package_id = a.package_id
                     WHERE p.provider_id = ?
                     ORDER BY a.available_date`,
                    [providerId]
                );

                return send(res, 200, {
                    success: true,
                    data: rows
                });
            }

            // =====================================
            // 7. ADD AVAILABILITY
            // =====================================

            if (req.method === "POST" && path === "/api/provider/availability") {

                const body = await getRequestBody(req);

                if (
                    !body.package_id ||
                    !body.available_date ||
                    !Number.isInteger(Number(body.total_capacity)) ||
                    Number(body.total_capacity) < 1
                ) {
                    return send(res, 400, {
                        success: false,
                        message: "package_id, available_date and positive total_capacity are required"
                    });
                }

                if (!await ownsPackage(Number(body.package_id), providerId)) {
                    return send(res, 404, {
                        success: false,
                        message: "Package not found"
                    });
                }

                const [result] = await db.query(
                    `INSERT INTO package_availability
                    (
                        package_id,
                        available_date,
                        total_capacity,
                        booked_seats,
                        status
                    )
                    VALUES (?, ?, ?, 0, 'available')`,
                    [
                        body.package_id,
                        body.available_date,
                        body.total_capacity
                    ]
                );

                return send(res, 201, {
                    success: true,
                    message: "Availability added",
                    data: {
                        availability_id: result.insertId
                    }
                });
            }

            // =====================================
            // 8. UPDATE AVAILABILITY
            // =====================================

            match = path.match(/^\/api\/provider\/availability\/(\d+)$/);

            if (match && req.method === "PUT") {

                const id = Number(match[1]);
                const body = await getRequestBody(req);

                const [result] = await db.query(
                    `UPDATE package_availability a
                     JOIN packages p ON p.package_id = a.package_id
                     SET
                        a.available_date = COALESCE(?, a.available_date),
                        a.total_capacity = COALESCE(?, a.total_capacity),
                        a.status = COALESCE(?, a.status)
                     WHERE
                        a.availability_id = ?
                        AND p.provider_id = ?
                        AND (? IS NULL OR ? >= a.booked_seats)`,
                    [
                        body.available_date ?? null,
                        body.total_capacity ?? null,
                        body.status ?? null,
                        id,
                        providerId,
                        body.total_capacity ?? null,
                        body.total_capacity ?? null
                    ]
                );

                if (!result.affectedRows) {
                    return send(res, 404, {
                        success: false,
                        message: "Availability not found or capacity is below booked seats"
                    });
                }

                return send(res, 200, {
                    success: true,
                    message: "Availability updated"
                });
            }

            // =====================================
            // 9. VIEW BOOKINGS
            // =====================================

            if (req.method === "GET" && path === "/api/provider/bookings") {

                const [rows] = await db.query(
                    `SELECT
                        b.*,
                        p.title,
                        u.name AS customer_name,
                        u.email AS customer_email,
                        a.available_date
                     FROM bookings b
                     JOIN packages p ON p.package_id = b.package_id
                     JOIN users u ON u.user_id = b.customer_id
                     JOIN package_availability a
                        ON a.availability_id = b.availability_id
                     WHERE p.provider_id = ?
                     ORDER BY b.booking_date DESC`,
                    [providerId]
                );

                return send(res, 200, {
                    success: true,
                    data: rows
                });
            }

            // =====================================
            // 10. UPDATE BOOKING STATUS
            // =====================================

            match = path.match(/^\/api\/provider\/bookings\/(\d+)$/);

            if (match && req.method === "PATCH") {

                const id = Number(match[1]);
                const body = await getRequestBody(req);

                if (!["confirmed", "completed", "cancelled"].includes(body.booking_status)) {
                    return send(res, 400, {
                        success: false,
                        message: "Invalid booking_status"
                    });
                }

                const [result] = await db.query(
                    `UPDATE bookings b
                     JOIN packages p ON p.package_id = b.package_id
                     SET b.booking_status = ?
                     WHERE
                        b.booking_id = ?
                        AND p.provider_id = ?
                        AND b.booking_status <> 'cancelled'`,
                    [
                        body.booking_status,
                        id,
                        providerId
                    ]
                );

                if (!result.affectedRows) {
                    return send(res, 404, {
                        success: false,
                        message: "Booking not found or cannot be updated"
                    });
                }

                return send(res, 200, {
                    success: true,
                    message: "Booking status updated",
                    data: {
                        booking_id: id,
                        booking_status: body.booking_status
                    }
                });
            }

            // =====================================
            // 11. VIEW REVIEWS
            // =====================================

            if (req.method === "GET" && path === "/api/provider/reviews") {

                const [rows] = await db.query(
                    `SELECT
                        r.*,
                        p.title,
                        u.name AS customer_name
                     FROM reviews r
                     JOIN packages p ON p.package_id = r.package_id
                     JOIN users u ON u.user_id = r.customer_id
                     WHERE p.provider_id = ?
                     ORDER BY r.review_date DESC`,
                    [providerId]
                );

                return send(res, 200, {
                    success: true,
                    data: rows
                });
            }

            // =====================================
            // 12. PROVIDER EARNINGS
            // =====================================

            if (req.method === "GET" && path === "/api/provider/earnings") {

                const [rows] = await db.query(
                    `SELECT
                        COUNT(*) AS paid_bookings,
                        COALESCE(SUM(pay.amount), 0) AS total_earnings
                     FROM payments pay
                     JOIN bookings b ON b.booking_id = pay.booking_id
                     JOIN packages p ON p.package_id = b.package_id
                     WHERE
                        p.provider_id = ?
                        AND pay.payment_status = 'success'`,
                    [providerId]
                );

                return send(res, 200, {
                    success: true,
                    data: rows[0]
                });
            }

            return send(res, 404, {
                success: false,
                message: "Provider API route not found"
            });

        } catch (error) {

            console.error("Provider API error:", error);

            if (error.code === "ER_DUP_ENTRY") {
                return send(res, 409, {
                    success: false,
                    message: "A record with these details already exists"
                });
            }

            if (error.code === "ER_NO_REFERENCED_ROW_2") {
                return send(res, 400, {
                    success: false,
                    message: "Invalid related record ID"
                });
            }

            return send(res, 500, {
                success: false,
                message: "Internal server error"
            });
        }
    };
};