// Role-restricted administration routes. All changes use the authenticated session.
module.exports = function createAdminRoutes({ db, sessions, getRequestBody }) {
  const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  // Record important administrative actions in system_logs.
  async function logAction(req, userId, action, description) {
    try {
      const forwardedFor = req.headers['x-forwarded-for'];
      const ipAddress = forwardedFor
        ? String(forwardedFor).split(',')[0].trim()
        : (req.socket?.remoteAddress || null);

      await db.query(
        `INSERT INTO system_logs (user_id, action, description, ip_address)
         VALUES (?, ?, ?, ?)`,
        [userId || null, action, description, ipAddress]
      );
    } catch (error) {
      // Logging failure should not undo an otherwise successful admin action.
      console.error('System log insert failed:', error);
    }
  }

  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (!url.pathname.startsWith('/api/admin/')) return;

    const requestedRole = url.searchParams.get('role') || 'admin';

    if (!['admin', 'super_admin'].includes(requestedRole)) {
      return send(res, 400, { message: 'Invalid admin role' });
    }

    const cookieName = requestedRole === 'super_admin'
      ? 'superAdminSessionId'
      : 'adminSessionId';

    const cookie = (req.headers.cookie || '')
      .split(';')
      .map(s => s.trim())
      .find(s => s.startsWith(cookieName + '='));

    const session = cookie && sessions.get(cookie.slice(cookieName.length + 1));

    if (!session || session.expiresAt <= Date.now()) {
      return send(res, 401, { message: 'Please log in' });
    }

    if (session.role !== requestedRole) {
      return send(res, 403, { message: 'Admin access required' });
    }

    try {
      const [roles] = await db.query(
        'SELECT role, status FROM users WHERE user_id = ?',
        [session.userId]
      );

      if (
        !roles.length ||
        roles[0].role !== session.role ||
        roles[0].status !== 'active'
      ) {
        return send(res, 403, { message: 'Admin account is not active' });
      }

      const p = url.pathname;

      // ADMIN OVERVIEW
      if (req.method === 'GET' && p === '/api/admin/overview') {
        const [[u]] = await db.query(
          "SELECT COUNT(*) AS customers FROM users WHERE role='customer'"
        );

        const [[v]] = await db.query(
          `SELECT
             COUNT(*) AS providers,
             COALESCE(SUM(status='pending'),0) AS pending_providers
           FROM users
           WHERE role='provider'`
        );

        const [[pkg]] = await db.query(
          `SELECT
             COUNT(*) AS packages,
             COALESCE(SUM(status='pending'),0) AS pending_packages
           FROM packages`
        );

        const [[b]] = await db.query(`
          SELECT
            COUNT(*) AS bookings,
            COALESCE(SUM(booking_status IN ('pending','confirmed')),0) AS active_bookings,
            COALESCE(SUM(booking_status='completed'),0) AS completed_bookings,
            COALESCE(SUM(booking_status='cancelled'),0) AS cancelled_bookings,
            COALESCE(SUM(
              CASE WHEN booking_status != 'cancelled'
              THEN total_amount ELSE 0 END
            ),0) AS booked_value
          FROM bookings
        `);

        return send(res, 200, {
          success: true,
          data: { ...u, ...v, ...pkg, ...b }
        });
      }

      // PROVIDERS
      if (req.method === 'GET' && p === '/api/admin/providers') {
        const [rows] = await db.query(
          `SELECT user_id AS id, name, email, mobile, status, created_at
           FROM users
           WHERE role='provider'
           ORDER BY created_at DESC`
        );

        return send(res, 200, { data: rows });
      }

      if (req.method === 'PATCH' && /^\/api\/admin\/providers\/\d+$/.test(p)) {
        const id = Number(p.split('/').pop());
        const { status } = await getRequestBody(req);

        if (!['active', 'pending', 'rejected', 'blocked'].includes(status)) {
          return send(res, 400, { message: 'Invalid provider status' });
        }

        const [result] = await db.query(
          "UPDATE users SET status=? WHERE user_id=? AND role='provider'",
          [status, id]
        );

        if (!result.affectedRows) {
          return send(res, 404, { message: 'Provider not found' });
        }

        await logAction(
          req,
          session.userId,
          'PROVIDER_STATUS_UPDATED',
          `Provider ID ${id} status changed to ${status}`
        );

        return send(res, 200, { message: 'Provider updated' });
      }

      // PACKAGES
      if (req.method === 'GET' && p === '/api/admin/packages') {
        const [rows] = await db.query(`
          SELECT
            p.package_id AS id,
            p.title,
            p.price,
            p.capacity,
            p.status,
            p.duration,
            d.name AS destination,
            u.name AS provider
          FROM packages p
          LEFT JOIN destinations d ON d.destination_id=p.destination_id
          LEFT JOIN users u ON u.user_id=p.provider_id
          ORDER BY p.created_at DESC
        `);

        return send(res, 200, { data: rows });
      }

      if (req.method === 'PATCH' && /^\/api\/admin\/packages\/\d+$/.test(p)) {
        const id = Number(p.split('/').pop());
        const { status } = await getRequestBody(req);

        if (!['active', 'pending', 'rejected', 'disabled'].includes(status)) {
          return send(res, 400, { message: 'Invalid package status' });
        }

        const [result] = await db.query(
          'UPDATE packages SET status=? WHERE package_id=?',
          [status, id]
        );

        if (!result.affectedRows) {
          return send(res, 404, { message: 'Package not found' });
        }

        await logAction(
          req,
          session.userId,
          'PACKAGE_STATUS_UPDATED',
          `Package ID ${id} status changed to ${status}`
        );

        return send(res, 200, { message: 'Package updated' });
      }

      // BOOKINGS
      if (req.method === 'GET' && p === '/api/admin/bookings') {
        const [rows] = await db.query(`
          SELECT
            b.booking_id AS id,
            b.booking_status AS status,
            b.total_amount,
            b.number_of_people,
            b.booking_date,
            p.title AS package_title,
            u.name AS customer
          FROM bookings b
          JOIN packages p ON p.package_id=b.package_id
          JOIN users u ON u.user_id=b.customer_id
          ORDER BY b.booking_date DESC
        `);

        return send(res, 200, { data: rows });
      }

      if (req.method === 'PATCH' && /^\/api\/admin\/bookings\/\d+$/.test(p)) {
        const id = Number(p.split('/').pop());
        const { status } = await getRequestBody(req);

        if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
          return send(res, 400, { message: 'Invalid booking status' });
        }

        const [result] = await db.query(
          'UPDATE bookings SET booking_status=? WHERE booking_id=?',
          [status, id]
        );

        if (!result.affectedRows) {
          return send(res, 404, { message: 'Booking not found' });
        }

        await logAction(
          req,
          session.userId,
          'BOOKING_STATUS_UPDATED',
          `Booking ID ${id} status changed to ${status}`
        );

        return send(res, 200, { message: 'Booking status updated' });
      }

      // CUSTOMERS
      if (req.method === 'GET' && p === '/api/admin/customers') {
        const [rows] = await db.query(
          `SELECT user_id AS id, name, email, mobile, status, created_at
           FROM users
           WHERE role='customer'
           ORDER BY created_at DESC`
        );

        return send(res, 200, { data: rows });
      }

      if (
        req.method === 'PATCH' &&
        /^\/api\/admin\/customers\/\d+\/status$/.test(p)
      ) {
        const id = Number(p.split('/')[4]);
        const { status } = await getRequestBody(req);

        if (!['active', 'blocked'].includes(status)) {
          return send(res, 400, { message: 'Invalid customer status' });
        }

        const [result] = await db.query(
          "UPDATE users SET status=? WHERE user_id=? AND role='customer'",
          [status, id]
        );

        if (!result.affectedRows) {
          return send(res, 404, { message: 'Customer not found' });
        }

        await logAction(
          req,
          session.userId,
          'CUSTOMER_STATUS_UPDATED',
          `Customer ID ${id} status changed to ${status}`
        );

        return send(res, 200, {
          success: true,
          message: 'Customer status updated'
        });
      }

      // REPORTS
      if (req.method === 'GET' && p === '/api/admin/reports') {
        const [[summary]] = await db.query(`
          SELECT
            COUNT(*) AS total_bookings,
            COALESCE(SUM(booking_status IN ('pending','confirmed')),0) AS active_bookings,
            COALESCE(SUM(booking_status='completed'),0) AS completed_bookings,
            COALESCE(SUM(booking_status='cancelled'),0) AS cancelled_bookings,
            COALESCE(SUM(
              CASE WHEN booking_status != 'cancelled'
              THEN total_amount ELSE 0 END
            ),0) AS total_booking_value
          FROM bookings
        `);

        const [monthly] = await db.query(`
          SELECT
            DATE_FORMAT(booking_date, '%Y-%m') AS month,
            COUNT(*) AS bookings,
            COALESCE(SUM(
              CASE WHEN booking_status != 'cancelled'
              THEN total_amount ELSE 0 END
            ),0) AS revenue
          FROM bookings
          GROUP BY DATE_FORMAT(booking_date, '%Y-%m')
          ORDER BY month
        `);

        return send(res, 200, {
          success: true,
          data: { summary, monthly }
        });
      }

      // SYSTEM ACTIVITY LOGS
      if (req.method === 'GET' && p === '/api/admin/logs') {
        const [rows] = await db.query(`
          SELECT
            l.log_id,
            l.user_id,
            u.name AS user_name,
            l.action,
            l.description,
            l.ip_address,
            l.created_at
          FROM system_logs l
          LEFT JOIN users u ON u.user_id = l.user_id
          ORDER BY l.created_at DESC
          LIMIT 200
        `);

        return send(res, 200, {
          success: true,
          data: rows
        });
      }

      // SUPER ADMIN: ADMINISTRATOR ACCOUNTS
      if (
        req.method === 'GET' &&
        p === '/api/admin/admins' &&
        session.role === 'super_admin'
      ) {
        const [rows] = await db.query(
          `SELECT user_id AS id, name, email, status, created_at
           FROM users
           WHERE role='admin'
           ORDER BY created_at DESC`
        );

        return send(res, 200, { data: rows });
      }

      if (
        req.method === 'PATCH' &&
        /^\/api\/admin\/admins\/\d+$/.test(p) &&
        session.role === 'super_admin'
      ) {
        const id = Number(p.split('/').pop());
        const { status } = await getRequestBody(req);

        if (!['active', 'blocked'].includes(status)) {
          return send(res, 400, { message: 'Invalid status' });
        }

        const [result] = await db.query(
          "UPDATE users SET status=? WHERE user_id=? AND role='admin'",
          [status, id]
        );

        if (!result.affectedRows) {
          return send(res, 404, { message: 'Admin not found' });
        }

        await logAction(
          req,
          session.userId,
          'ADMIN_STATUS_UPDATED',
          `Admin ID ${id} status changed to ${status}`
        );

        return send(res, 200, { message: 'Admin updated' });
      }

      // DESTINATIONS
      if (req.method === 'GET' && p === '/api/admin/destinations') {
        const [rows] = await db.query(
          'SELECT * FROM destinations ORDER BY name'
        );

        return send(res, 200, { success: true, data: rows });
      }

      if (req.method === 'POST' && p === '/api/admin/destinations') {
        const { name, city, state, country } = await getRequestBody(req);

        if (!name?.trim() || !city?.trim() || !state?.trim() || !country?.trim()) {
          return send(res, 400, {
            message: 'All destination fields are required'
          });
        }

        const [result] = await db.query(
          `INSERT INTO destinations (name, city, state, country, status)
           VALUES (?, ?, ?, ?, 'active')`,
          [name.trim(), city.trim(), state.trim(), country.trim()]
        );

        await logAction(
          req,
          session.userId,
          'DESTINATION_ADDED',
          `Destination "${name.trim()}" added (ID ${result.insertId})`
        );

        return send(res, 201, {
          success: true,
          message: 'Destination added',
          id: result.insertId
        });
      }

      if (
        req.method === 'PUT' &&
        /^\/api\/admin\/destinations\/\d+$/.test(p)
      ) {
        const id = Number(p.split('/').pop());
        const { name, city, state, country, status } = await getRequestBody(req);

        if (
          !name?.trim() ||
          !city?.trim() ||
          !state?.trim() ||
          !country?.trim() ||
          !['active', 'inactive'].includes(status)
        ) {
          return send(res, 400, { message: 'Invalid destination details' });
        }

        const [result] = await db.query(
          `UPDATE destinations
           SET name=?, city=?, state=?, country=?, status=?
           WHERE destination_id=?`,
          [name.trim(), city.trim(), state.trim(), country.trim(), status, id]
        );

        if (!result.affectedRows) {
          return send(res, 404, { message: 'Destination not found' });
        }

        await logAction(
          req,
          session.userId,
          'DESTINATION_UPDATED',
          `Destination ID ${id} (${name.trim()}) updated`
        );

        return send(res, 200, {
          success: true,
          message: 'Destination updated'
        });
      }

      // CATEGORIES
      if (req.method === 'GET' && p === '/api/admin/categories') {
        const [rows] = await db.query(
          'SELECT * FROM categories ORDER BY name'
        );

        return send(res, 200, { success: true, data: rows });
      }

      if (req.method === 'POST' && p === '/api/admin/categories') {
        const { name, description } = await getRequestBody(req);

        if (!name?.trim()) {
          return send(res, 400, { message: 'Category name is required' });
        }

        const [result] = await db.query(
          `INSERT INTO categories (name, description, status)
           VALUES (?, ?, 'active')`,
          [name.trim(), description || null]
        );

        await logAction(
          req,
          session.userId,
          'CATEGORY_ADDED',
          `Category "${name.trim()}" added (ID ${result.insertId})`
        );

        return send(res, 201, {
          success: true,
          message: 'Category added',
          id: result.insertId
        });
      }

      if (
        req.method === 'PUT' &&
        /^\/api\/admin\/categories\/\d+$/.test(p)
      ) {
        const id = Number(p.split('/').pop());
        const { name, description, status } = await getRequestBody(req);

        if (
          !name?.trim() ||
          !['active', 'inactive'].includes(status)
        ) {
          return send(res, 400, { message: 'Invalid category details' });
        }

        const [result] = await db.query(
          `UPDATE categories
           SET name=?, description=?, status=?
           WHERE category_id=?`,
          [name.trim(), description || null, status, id]
        );

        if (!result.affectedRows) {
          return send(res, 404, { message: 'Category not found' });
        }

        await logAction(
          req,
          session.userId,
          'CATEGORY_UPDATED',
          `Category ID ${id} (${name.trim()}) updated`
        );

        return send(res, 200, {
          success: true,
          message: 'Category updated'
        });
      }

      return send(res, 404, { message: 'Admin endpoint unavailable' });

    } catch (err) {
      console.error('Admin API error:', err);

      return send(res, 500, {
        message: 'Admin operation failed; check database schema and server logs'
      });
    }
  };
};