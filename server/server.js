const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
require("dotenv").config();
const crypto = require("crypto");

const http = require("http");
const db = require("./db");


function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;

            if (body.length > 10000) {
                reject(new Error("Request body too large"));
                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });

        req.on("error", reject);
    });
}
// Temporary in-memory session storage
const sessions = new Map();

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const createProviderRoutes = require("./providerRoutes");
const handleProviderRoutes = createProviderRoutes({
    db,
    sessions,
    getRequestBody
});
const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    // Health check
    if (req.method === "GET" && req.url === "/api/health") {
        try {
            await db.query("SELECT 1");

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                message: "Tourism Booking API is running",
                database: "Connected"
            }));
            
        } catch (error) {
            console.error(error.message);
            res.writeHead(500);
            res.end(JSON.stringify({
                success: false,
                message: "Database connection failed"
            }));
        }
        return;
    }



// GET: Retrieve logged-in customer's booking history
if (req.method === "GET" && req.url === "/api/bookings/my-bookings") {
    try {
        // 1. Verify login session
        const cookies = req.headers.cookie || "";

        const sessionCookie = cookies
            .split(";")
            .find(cookie => cookie.trim().startsWith("sessionId="));

        if (!sessionCookie) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Please log in to view your bookings"
            }));
            return;
        }

        const sessionId = sessionCookie.trim().split("=")[1];
        const session = sessions.get(sessionId);

        if (!session || session.expiresAt < Date.now()) {
            sessions.delete(sessionId);

            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Session expired or invalid"
            }));
            return;
        }

        // Only customers can view customer booking history
        if (session.role !== "customer") {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Only customers can view these bookings"
            }));
            return;
        }

        // 2. Retrieve bookings belonging to this customer
        const [rows] = await db.query(`
            SELECT
                b.booking_id,
                b.package_id,
                p.title AS package_title,
                d.name AS destination,
                DATE_FORMAT(pa.available_date, '%Y-%m-%d') AS travel_date,
                b.number_of_people,
                b.total_amount,
                b.booking_status,
                DATE_FORMAT(b.booking_date, '%Y-%m-%d %H:%i:%s') AS booking_date
            FROM bookings b
            JOIN packages p
                ON b.package_id = p.package_id
            JOIN destinations d
                ON p.destination_id = d.destination_id
            JOIN package_availability pa
                ON b.availability_id = pa.availability_id
            WHERE b.customer_id = ?
            ORDER BY b.booking_date DESC
        `, [session.userId]);

        const bookings = rows.map(booking => ({
            ...booking,
            number_of_people: Number(booking.number_of_people),
            total_amount: Number(booking.total_amount)
        }));

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            count: bookings.length,
            bookings
        }));

    } catch (error) {
        console.error(error.message);

        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: false,
            message: "Failed to retrieve booking history"
        }));
    }

    return;
}

// GET: Retrieve details of a specific customer booking
if (
    req.method === "GET" &&
    /^\/api\/bookings\/\d+$/.test(req.url.split("?")[0])
) {
    try {
        // 1. Verify login session
        const cookies = req.headers.cookie || "";

        const sessionCookie = cookies
            .split(";")
            .find(cookie => cookie.trim().startsWith("sessionId="));

        if (!sessionCookie) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Please log in to view booking details"
            }));
            return;
        }

        const sessionId = sessionCookie.trim().split("=")[1];
        const session = sessions.get(sessionId);

        if (!session || session.expiresAt < Date.now()) {
            sessions.delete(sessionId);

            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Session expired or invalid"
            }));
            return;
        }

        // Only customers can access this endpoint
        if (session.role !== "customer") {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Only customers can view booking details"
            }));
            return;
        }

        // 2. Extract booking ID
        const bookingId = Number(req.url.split("?")[0].split("/").pop());

        // 3. Retrieve booking only if it belongs to this customer
        const [rows] = await db.query(`
            SELECT
                b.booking_id,
                b.package_id,
                p.title AS package_title,
                p.description,
                d.name AS destination,
                c.name AS category,
                p.duration,
                DATE_FORMAT(pa.available_date, '%Y-%m-%d') AS travel_date,
                b.number_of_people,
                b.total_amount,
                b.booking_status,
                DATE_FORMAT(b.booking_date, '%Y-%m-%d %H:%i:%s') AS booking_date
            FROM bookings b
            JOIN packages p ON b.package_id = p.package_id
            JOIN destinations d ON p.destination_id = d.destination_id
            JOIN categories c ON p.category_id = c.category_id
            JOIN package_availability pa
                ON b.availability_id = pa.availability_id
            WHERE b.booking_id = ?
              AND b.customer_id = ?
        `, [bookingId, session.userId]);

        // 4. Check whether booking exists for this customer
        if (rows.length === 0) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Booking not found"
            }));
            return;
        }

        const booking = {
            ...rows[0],
            duration: Number(rows[0].duration),
            number_of_people: Number(rows[0].number_of_people),
            total_amount: Number(rows[0].total_amount)
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            booking
        }));

    } catch (error) {
        console.error(error.message);

        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: false,
            message: "Failed to retrieve booking details"
        }));
    }

    return;
}

// POST: Create a customer booking
if (req.method === "POST" && req.url === "/api/bookings") {
    let connection;

    try {
        // 1. Verify login session
        const cookies = req.headers.cookie || "";

        const sessionCookie = cookies
            .split(";")
            .find(cookie => cookie.trim().startsWith("sessionId="));

        if (!sessionCookie) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Please log in to book a package"
            }));
            return;
        }

        const sessionId = sessionCookie.trim().split("=")[1];
        const session = sessions.get(sessionId);

        if (!session || session.expiresAt < Date.now()) {
            sessions.delete(sessionId);

            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Session expired or invalid"
            }));
            return;
        }

        // Only customers can make bookings
        if (session.role !== "customer") {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Only customers can make bookings"
            }));
            return;
        }

        // 2. Read request data
        const body = await getRequestBody(req);

        const packageId = Number(body.package_id);
        const availabilityId = Number(body.availability_id);
        const numberOfPeople = Number(body.number_of_people);

        if (
            !Number.isInteger(packageId) || packageId <= 0 ||
            !Number.isInteger(availabilityId) || availabilityId <= 0 ||
            !Number.isInteger(numberOfPeople) || numberOfPeople <= 0
        ) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Invalid package, availability or number of people"
            }));
            return;
        }

        // 3. Start database transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Lock the availability row to prevent overbooking
        const [availabilityRows] = await connection.query(`
            SELECT
                pa.availability_id,
                pa.package_id,
                pa.available_date,
                pa.total_capacity,
                pa.booked_seats,
                pa.status,
                p.price
            FROM package_availability pa
            JOIN packages p
                ON pa.package_id = p.package_id
            WHERE pa.availability_id = ?
              AND pa.package_id = ?
            FOR UPDATE
        `, [availabilityId, packageId]);

        if (availabilityRows.length === 0) {
            await connection.rollback();

            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Package availability not found"
            }));
            return;
        }

        const availability = availabilityRows[0];

        // 4. Check date and availability
        const remainingSeats =
            Number(availability.total_capacity) -
            Number(availability.booked_seats);

        const [dateRows] = await connection.query(`
            SELECT available_date >= CURDATE() AS is_future
            FROM package_availability
            WHERE availability_id = ?
        `, [availabilityId]);

        if (
            availability.status !== "available" ||
            Number(dateRows[0].is_future) !== 1
        ) {
            await connection.rollback();

            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "This booking date is unavailable"
            }));
            return;
        }

        if (numberOfPeople > remainingSeats) {
            await connection.rollback();

            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: `Only ${remainingSeats} seats are available`
            }));
            return;
        }

        // 5. Calculate total amount using database price
        const pricePerPerson = Number(availability.price);
        const totalAmount = pricePerPerson * numberOfPeople;

        // 6. Insert booking
        const [bookingResult] = await connection.query(`
            INSERT INTO bookings
            (
                customer_id,
                package_id,
                availability_id,
                number_of_people,
                total_amount,
                booking_status
            )
            VALUES (?, ?, ?, ?, ?, 'pending')
        `, [
            session.userId,
            packageId,
            availabilityId,
            numberOfPeople,
            totalAmount
        ]);

        // 7. Update booked seats
        await connection.query(`
            UPDATE package_availability
            SET booked_seats = booked_seats + ?
            WHERE availability_id = ?
        `, [numberOfPeople, availabilityId]);

        // 8. Commit transaction
        await connection.commit();

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            message: "Booking created successfully",
            booking: {
                booking_id: bookingResult.insertId,
                package_id: packageId,
                availability_id: availabilityId,
                number_of_people: numberOfPeople,
                price_per_person: pricePerPerson,
                total_amount: totalAmount,
                booking_status: "pending"
            }
        }));

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error(error.message);

        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: false,
            message: "Failed to create booking"
        }));

    } finally {
        if (connection) {
            connection.release();
        }
    }

    return;
}

// DELETE: Cancel a customer booking
if (
    req.method === "DELETE" &&
    /^\/api\/bookings\/\d+$/.test(req.url.split("?")[0])
) {
    let connection;

    try {
        // 1. Verify login session
        const cookies = req.headers.cookie || "";

        const sessionCookie = cookies
            .split(";")
            .find(cookie => cookie.trim().startsWith("sessionId="));

        if (!sessionCookie) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Please log in to cancel a booking"
            }));
            return;
        }

        const sessionId = sessionCookie.trim().split("=")[1];
        const session = sessions.get(sessionId);

        if (!session || session.expiresAt < Date.now()) {
            sessions.delete(sessionId);

            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Session expired or invalid"
            }));
            return;
        }

        if (session.role !== "customer") {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Only customers can cancel bookings"
            }));
            return;
        }

        // 2. Extract booking ID
        const bookingId = Number(req.url.split("?")[0].split("/").pop());

        connection = await db.getConnection();
        await connection.beginTransaction();

        // 3. Find and lock the customer's booking
        const [rows] = await connection.query(`
            SELECT
                booking_id,
                availability_id,
                number_of_people,
                booking_status
            FROM bookings
            WHERE booking_id = ?
              AND customer_id = ?
            FOR UPDATE
        `, [bookingId, session.userId]);

        if (rows.length === 0) {
            await connection.rollback();

            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Booking not found"
            }));
            return;
        }

        const booking = rows[0];

        // 4. Prevent repeated cancellation
        if (booking.booking_status === "cancelled") {
            await connection.rollback();

            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Booking is already cancelled"
            }));
            return;
        }

        // 5. Restore reserved seats
        await connection.query(`
            UPDATE package_availability
            SET booked_seats = GREATEST(0, booked_seats - ?)
            WHERE availability_id = ?
        `, [booking.number_of_people, booking.availability_id]);

        // 6. Update booking status
        await connection.query(`
            UPDATE bookings
            SET booking_status = 'cancelled'
            WHERE booking_id = ?
        `, [bookingId]);
        // Refund successful payments (simulation only)
        const [refundResult] = await connection.query(`
            UPDATE payments
            SET payment_status = 'refunded'
            WHERE booking_id = ?
            AND payment_status = 'success'
        `, [bookingId]);

        const refundIssued = refundResult.affectedRows > 0;

        await connection.commit();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            message: "Booking cancelled successfully",
            booking_id: bookingId,
            booking_status: "cancelled",
            seats_restored: Number(booking.number_of_people),
            refund_status: refundIssued ? "refunded" : "not_applicable",
            refund_message: refundIssued ? "Simulated refund completed successfully" : "No successful payment found for this booking"
        }));

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error(error.message);

        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: false,
            message: "Failed to cancel booking"
        }));

    } finally {
        if (connection) {
            connection.release();
        }
    }

    return;
}

// POST: Simulate customer payment
if (req.method === "POST" && req.url === "/api/payments") {
    let connection;

    try {
        // 1. Verify login session
        const cookies = req.headers.cookie || "";

        const sessionCookie = cookies
            .split(";")
            .find(cookie => cookie.trim().startsWith("sessionId="));

        if (!sessionCookie) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Please log in to make a payment"
            }));
            return;
        }

        const sessionId = sessionCookie.trim().split("=")[1];
        const session = sessions.get(sessionId);

        if (!session || session.expiresAt < Date.now()) {
            sessions.delete(sessionId);

            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Session expired or invalid"
            }));
            return;
        }

        if (session.role !== "customer") {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Only customers can make payments"
            }));
            return;
        }

        // 2. Read request body
        const body = await getRequestBody(req);
        const bookingId = Number(body.booking_id);
        const paymentMethod = body.payment_method;

        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Invalid booking ID"
            }));
            return;
        }

        const allowedMethods = ["UPI", "CARD", "NET_BANKING"];

        if (!allowedMethods.includes(paymentMethod)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Invalid payment method"
            }));
            return;
        }

        // 3. Start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 4. Find and lock customer's booking
        const [bookings] = await connection.query(`
            SELECT booking_id, total_amount, booking_status
            FROM bookings
            WHERE booking_id = ?
              AND customer_id = ?
            FOR UPDATE
        `, [bookingId, session.userId]);

        if (bookings.length === 0) {
            await connection.rollback();

            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Booking not found"
            }));
            return;
        }

        const booking = bookings[0];

        if (booking.booking_status !== "pending") {
            await connection.rollback();

            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Only pending bookings can be paid for"
            }));
            return;
        }

        // 5. Generate simulated transaction ID
        const transactionId =
            "DEMO-" + require("crypto").randomBytes(8).toString("hex").toUpperCase();

        const amount = Number(booking.total_amount);

        // 6. Save successful simulated payment
        const [paymentResult] = await connection.query(`
            INSERT INTO payments
            (
                booking_id,
                amount,
                payment_method,
                transaction_id,
                payment_status
            )
            VALUES (?, ?, ?, ?, 'success')
        `, [
            bookingId,
            amount,
            paymentMethod,
            transactionId
        ]);

        // 7. Confirm booking
        await connection.query(`
            UPDATE bookings
            SET booking_status = 'confirmed'
            WHERE booking_id = ?
        `, [bookingId]);

        // 8. Commit transaction
        await connection.commit();

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            message: "Simulated payment successful",
            payment: {
                payment_id: paymentResult.insertId,
                booking_id: bookingId,
                amount: amount,
                payment_method: paymentMethod,
                transaction_id: transactionId,
                payment_status: "success"
            },
            booking_status: "confirmed"
        }));

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error(error.message);

        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: false,
            message: "Payment processing failed"
        }));

    } finally {
        if (connection) {
            connection.release();
        }
    }

    return;
}

// POST: Submit a package review
if (req.method === "POST" && req.url === "/api/reviews") {
    try {
        // 1. Verify login session
        const cookies = req.headers.cookie || "";

        const sessionCookie = cookies
            .split(";")
            .find(cookie => cookie.trim().startsWith("sessionId="));

        if (!sessionCookie) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Please log in to submit a review"
            }));
            return;
        }

        const sessionId = sessionCookie.trim().split("=")[1];
        const session = sessions.get(sessionId);

        if (!session || session.expiresAt < Date.now()) {
            sessions.delete(sessionId);

            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Session expired or invalid"
            }));
            return;
        }

        if (session.role !== "customer") {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Only customers can submit reviews"
            }));
            return;
        }

        // 2. Read and validate request body
        const body = await getRequestBody(req);
        const bookingId = Number(body.booking_id);
        const rating = Number(body.rating);
        const comment = body.comment || null;

        if (
            !Number.isInteger(bookingId) || bookingId <= 0 ||
            !Number.isInteger(rating) || rating < 1 || rating > 5 ||
            (comment !== null &&
                (typeof comment !== "string" || comment.length > 1000))
        ) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Invalid booking ID, rating or comment"
            }));
            return;
        }

        // 3. Check booking ownership and completion
        const [bookings] = await db.query(`
            SELECT booking_id, package_id
            FROM bookings
            WHERE booking_id = ?
              AND customer_id = ?
              AND booking_status = 'completed'
        `, [bookingId, session.userId]);

        if (bookings.length === 0) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Only completed bookings can be reviewed"
            }));
            return;
        }

        // 4. Insert review
        const [result] = await db.query(`
            INSERT INTO reviews
            (booking_id, customer_id, package_id, rating, comment)
            VALUES (?, ?, ?, ?, ?)
        `, [
            bookingId,
            session.userId,
            bookings[0].package_id,
            rating,
            comment
        ]);

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            message: "Review submitted successfully",
            review_id: result.insertId
        }));

    } catch (error) {
        console.error(error.message);

        if (error.code === "ER_DUP_ENTRY") {
            res.writeHead(409, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "You have already reviewed this booking"
            }));
            return;
        }

        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: false,
            message: "Failed to submit review"
        }));
    }

    return;
}

// GET: Retrieve reviews for a package
if (
    req.method === "GET" &&
    /^\/api\/packages\/\d+\/reviews$/.test(req.url.split("?")[0])
) {
    try {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const packageId = Number(url.pathname.split("/")[3]);

        const [packages] = await db.query(
            "SELECT package_id FROM packages WHERE package_id = ?",
            [packageId]
        );

        if (packages.length === 0) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Package not found"
            }));
            return;
        }

        const [rows] = await db.query(`
            SELECT
                r.review_id,
                r.rating,
                r.comment,
                r.review_date,
                u.name AS customer_name
            FROM reviews r
            JOIN users u ON r.customer_id = u.user_id
            WHERE r.package_id = ?
            ORDER BY r.review_date DESC
        `, [packageId]);

        const [ratingRows] = await db.query(`
            SELECT
                ROUND(AVG(rating), 2) AS average_rating,
                COUNT(*) AS total_reviews
            FROM reviews
            WHERE package_id = ?
        `, [packageId]);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            package_id: packageId,
            average_rating: Number(ratingRows[0].average_rating) || 0,
            total_reviews: Number(ratingRows[0].total_reviews),
            reviews: rows
        }));

    } catch (error) {
        console.error(error.message);

        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: false,
            message: "Failed to retrieve reviews"
        }));
    }

    return;
}


// GET: Retrieve details of a single package
if (req.method === "GET" && /^\/api\/packages\/\d+$/.test(req.url.split("?")[0])) {
    try {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const packageId = Number(url.pathname.split("/").pop());

        // Retrieve package details
        const [rows] = await db.query(`
            SELECT
                p.package_id AS id,
                p.title,
                p.description,
                d.name AS destination,
                c.name AS category,
                p.duration,
                p.price,
                p.capacity,
                DATE_FORMAT(p.available_from, '%Y-%m-%d') AS available_from,
                p.badge,
                p.image_url AS image,
                COALESCE(rv.average_rating, 0) AS rating,
                COALESCE(rv.total_reviews, 0) AS reviews
            FROM packages p
            JOIN destinations d
                ON p.destination_id = d.destination_id
            JOIN categories c
                ON p.category_id = c.category_id
            LEFT JOIN (
            SELECT
                package_id,
                AVG(rating) AS average_rating,
                COUNT(*) AS total_reviews
            FROM reviews
            GROUP BY package_id
        ) rv ON p.package_id = rv.package_id
            WHERE p.package_id = ?
        `, [packageId]);

        // Check whether package exists
        if (rows.length === 0) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Package not found"
            }));
            return;
        }

        const pkg = rows[0];

        // Retrieve package experience modes
        const [modeRows] = await db.query(`
            SELECT mode
            FROM package_modes
            WHERE package_id = ?
        `, [packageId]);

        const packageDetails = {
            ...pkg,
            price: Number(pkg.price),
            rating: Number(pkg.rating),
            reviews: Number(pkg.reviews),
            mode: modeRows.map(item => item.mode)
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            package: packageDetails
        }));

    } catch (error) {
        console.error(error.message);

        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: false,
            message: "Failed to retrieve package details"
        }));
    }

    return;
}


 // GET: Retrieve availability for a package
if (
    req.method === "GET" &&
    /^\/api\/packages\/\d+\/availability$/.test(req.url.split("?")[0])
) {
    try {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const packageId = Number(url.pathname.split("/")[3]);

        // Check whether package exists
        const [packages] = await db.query(
            "SELECT package_id FROM packages WHERE package_id = ?",
            [packageId]
        );

        if (packages.length === 0) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: "Package not found"
            }));
            return;
        }

        // Retrieve upcoming availability dates
        const [rows] = await db.query(`
            SELECT
                availability_id,
                DATE_FORMAT(available_date, '%Y-%m-%d') AS available_date,
                total_capacity,
                booked_seats,
                (total_capacity - booked_seats) AS remaining_seats,
                status
            FROM package_availability
            WHERE package_id = ?
              AND available_date >= CURDATE()
            ORDER BY available_date
        `, [packageId]);

        const availability = rows.map(item => ({
            ...item,
            total_capacity: Number(item.total_capacity),
            booked_seats: Number(item.booked_seats),
            remaining_seats: Number(item.remaining_seats),
            is_available:
                item.status === "available" &&
                Number(item.remaining_seats) > 0
        }));

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            package_id: packageId,
            count: availability.length,
            availability
        }));

    } catch (error) {
        console.error(error.message);

        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: false,
            message: "Failed to retrieve package availability"
        }));
    }

    return;
}


if (
    req.method === "GET" &&
    (req.url === "/api/packages" || req.url.startsWith("/api/packages?"))
) {
    try {
        // Read filter values from URL
        const url = new URL(req.url, `http://localhost:${PORT}`);

        const search = url.searchParams.get("search");
        const destination = url.searchParams.get("destination");
        const category = url.searchParams.get("category");
        const maxPrice = url.searchParams.get("maxPrice");
        const duration = url.searchParams.get("duration");
        const date = url.searchParams.get("date");

        // Build SQL conditions dynamically
        let conditions = [];
        let values = [];

        if (search) {
            conditions.push(
                "(p.title LIKE ? OR d.name LIKE ? OR c.name LIKE ?)"
            );
            const keyword = `%${search}%`;
            values.push(keyword, keyword, keyword);
        }

        if (destination) {
            conditions.push("d.name = ?");
            values.push(destination);
        }

        if (category) {
            conditions.push("c.name = ?");
            values.push(category);
        }

        if (maxPrice && Number(maxPrice) > 0) {
            conditions.push("p.price <= ?");
            values.push(Number(maxPrice));
        }

        // Duration filter
        if (duration === "1") {
            conditions.push("p.duration = 1");
        } else if (duration === "2-3") {
            conditions.push("p.duration BETWEEN 2 AND 3");
        } else if (duration === "4-7") {
            conditions.push("p.duration BETWEEN 4 AND 7");
        } else if (duration === "7+") {
            conditions.push("p.duration > 7");
        }

        // Availability date filter
        if (date) {
            conditions.push(
                "(p.available_from <= ? OR p.available_from IS NULL)"
            );
            values.push(date);
        }

        const whereClause = conditions.length
            ? "WHERE " + conditions.join(" AND ")
            : "";

        // Retrieve matching packages
        const [rows] = await db.query(`
            SELECT
            p.package_id AS id,
            p.title,
            d.name AS destination,
            c.name AS category,
            p.duration,
            p.price,
            DATE_FORMAT(p.available_from, '%Y-%m-%d') AS available_from,
            p.badge,
            p.image_url AS image,
            COALESCE(rv.average_rating, 0) AS rating,
            COALESCE(rv.total_reviews, 0) AS reviews
            FROM packages p
            JOIN destinations d
                ON p.destination_id = d.destination_id
            JOIN categories c
                ON p.category_id = c.category_id
            LEFT JOIN (
            SELECT
                package_id,
                AVG(rating) AS average_rating,
                COUNT(*) AS total_reviews
            FROM reviews
            GROUP BY package_id
        ) rv ON p.package_id = rv.package_id
            ${whereClause}
            ORDER BY p.package_id
        `, values);

        // Retrieve experience modes
        const [modeRows] = await db.query(`
            SELECT package_id, mode
            FROM package_modes
        `);

        const packages = rows.map(pkg => ({
            ...pkg,
            price: Number(pkg.price),
            rating: Number(pkg.rating),
            reviews: Number(pkg.reviews),
            mode: modeRows
                .filter(item => item.package_id === pkg.id)
                .map(item => item.mode)
        }));

        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            count: packages.length,
            packages
        }));

    } catch (error) {
        console.error(error.message);

        res.writeHead(500);
        res.end(JSON.stringify({
            success: false,
            message: "Failed to retrieve packages"
        }));
    }

    return;
}
// User registration
if (req.method === "POST" && req.url === "/api/auth/register") {
    try {
        const { name, email, mobile, password, confirm_password, role } =
            await getRequestBody(req);

        // Validate fields
        if (!name || !email || !mobile || !password || !confirm_password || !role) {
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                message: "All fields are required"
            }));
            return;
        }

        if (name.trim().length < 3 || name.trim().length > 80) {
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                message: "Name must contain 3 to 80 characters"
            }));
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                message: "Invalid email address"
            }));
            return;
        }

        if (!/^[6-9]\d{9}$/.test(mobile)) {
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                message: "Invalid mobile number"
            }));
            return;
        }

        if (password.length < 8) {
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                message: "Password must contain at least 8 characters"
            }));
            return;
        }

        if (password !== confirm_password) {
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                message: "Passwords do not match"
            }));
            return;
        }

        if (!["customer", "provider"].includes(role)) {
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                message: "Invalid account type"
            }));
            return;
        }

        // Check duplicate email
        const [existingUsers] = await db.query(
            "SELECT user_id FROM users WHERE email = ?",
            [email.trim().toLowerCase()]
        );

        if (existingUsers.length > 0) {
            res.writeHead(409);
            res.end(JSON.stringify({
                success: false,
                message: "Email is already registered"
            }));
            return;
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Insert user
        const [result] = await db.query(
            `INSERT INTO users
            (name, email, mobile, password_hash, role)
            VALUES (?, ?, ?, ?, ?)`,
            [
                name.trim(),
                email.trim().toLowerCase(),
                mobile,
                passwordHash,
                role
            ]
        );

        res.writeHead(201);
        res.end(JSON.stringify({
            success: true,
            message: "Registration successful",
            user: {
                id: result.insertId,
                name: name.trim(),
                email: email.trim().toLowerCase(),
                role
            }
        }));

    } catch (error) {
        console.error(error.message);

        res.writeHead(500);
        res.end(JSON.stringify({
            success: false,
            message: "Registration failed"
        }));
    }

    return;
}

// User login
if (req.method === "POST" && req.url === "/api/auth/login") {
    try {
        const { email, password } = await getRequestBody(req);

        if (!email || !password) {
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                message: "Email and password are required"
            }));
            return;
        }

        // Find user
        const [users] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email.trim().toLowerCase()]
        );

        if (users.length === 0) {
            res.writeHead(401);
            res.end(JSON.stringify({
                success: false,
                message: "Invalid email or password"
            }));
            return;
        }

        const user = users[0];

        // Verify password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            res.writeHead(401);
            res.end(JSON.stringify({
                success: false,
                message: "Invalid email or password"
            }));
            return;
        }
        // Create a new session
        const sessionId = crypto.randomBytes(32).toString("hex");

        sessions.set(sessionId, {
            userId: user.user_id,
            name: user.name,
            email: user.email,
            role: user.role,
            expiresAt: Date.now() + SESSION_DURATION
        });

        // Send session ID as an HTTP-only cookie
        res.setHeader(
            "Set-Cookie",
            `sessionId=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`
        );

        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            message: "Login successful",
            user: {
                id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        }));

    } catch (error) {
        console.error(error.message);

        res.writeHead(500);
        res.end(JSON.stringify({
            success: false,
            message: "Login failed"
        }));
    }

    return;
}
// Check whether the user is logged in
if (req.method === "GET" && req.url === "/api/auth/me") {
    const cookies = req.headers.cookie || "";

    const sessionCookie = cookies
        .split(";")
        .find(cookie => cookie.trim().startsWith("sessionId="));

    if (!sessionCookie) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: false,
            message: "Not logged in"
        }));
        return;
    }

    const sessionId = sessionCookie.trim().split("=")[1];
    const session = sessions.get(sessionId);

    if (!session || session.expiresAt < Date.now()) {
        sessions.delete(sessionId);

        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: false,
            message: "Session expired or invalid"
        }));
        return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
        success: true,
        user: {
            id: session.userId,
            name: session.name,
            email: session.email,
            role: session.role
        }
    }));

    return;
}

// Log out the user
if (req.method === "POST" && req.url === "/api/auth/logout") {
    const cookies = req.headers.cookie || "";

    const sessionCookie = cookies
        .split(";")
        .find(cookie => cookie.trim().startsWith("sessionId="));

    if (sessionCookie) {
        const sessionId = sessionCookie.trim().split("=")[1];
        sessions.delete(sessionId);
    }

    res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": "sessionId=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    });

    res.end(JSON.stringify({
        success: true,
        message: "Logged out successfully"
    }));

    return;
}


    // Serve frontend files from public folder
if (req.method === "GET"&&
    !req.url.startsWith("/api/")) {
    const publicDir = path.join(__dirname, "../public");

    const pathname = new URL(req.url, "http://localhost").pathname;

    let requestedFile = pathname === "/"
        ? "index.html"
        : decodeURIComponent(pathname.slice(1));

    const filePath = path.resolve(publicDir, requestedFile);

    // Prevent access outside public folder
    if (filePath.startsWith(publicDir + path.sep) || filePath === publicDir) {
        fs.readFile(filePath, (error, content) => {
            if (error) {
                res.writeHead(404);
                res.end("Page not found");
                return;
            }

            const ext = path.extname(filePath).toLowerCase();

            const contentTypes = {
                ".html": "text/html",
                ".css": "text/css",
                ".js": "application/javascript",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".svg": "image/svg+xml"
            };

            res.writeHead(200, {
                "Content-Type": contentTypes[ext] || "application/octet-stream"
            });

            res.end(content);
        });

        return;
    }
    
}
await handleProviderRoutes(req, res);

if (res.writableEnded) return;
   
// Unknown route
res.writeHead(404);
res.end(JSON.stringify({
    success: false,
    message: "Route not found"
}));
});

const PORT = Number(process.env.PORT) || 3000;

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});