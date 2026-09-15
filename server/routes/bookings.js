const express = require("express");
const pool = require("../config/db");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();

// Helper to format booking for frontend compatibility
const formatBooking = (b, addons = [], payment = null, feedback = null) => ({
  ref: b.booking_reference,
  id: b.id,
  pkg: b.package_name || b.pkg || "",
  packageId: b.package_code || "",
  date: b.event_date ? String(b.event_date).slice(0, 10) : "",
  time: b.event_time ? String(b.event_time).slice(0, 5) : "",
  venue: b.venue_address || b.venue_name || "",
  venueName: b.venue_name || "",
  guests: Number(b.guest_count || 0),
  addons: addons.map((a) => ({
    id: a.addon_code || a.code || a.id,
    name: a.name,
    price: Number(a.unit_price || a.price || 0),
    unit: a.unit_type === "per_head" ? "per head" : "flat",
    quantity: Number(a.quantity || 1),
    img: a.image_url || "",
    icon: a.icon || "sparkles-outline",
  })),
  total: Number(b.total_amount || 0),
  deposit: Number(b.deposit_amount || 0),
  balance: Number(b.balance_amount || 0),
  status: b.status || "confirmed",
  rated: Boolean(feedback || b.rated),
  rating: feedback ? feedback.rating : null,
  feedbackComment: feedback ? feedback.comment : null,
  method: payment ? payment.payment_method : b.method || "Cash on Delivery",
  paymentStatus: payment ? payment.status : "pending",
  customer: {
    name: b.customer_name || (b.first_name ? `${b.first_name} ${b.last_name}`.trim() : "Guest"),
    phone: b.customer_phone || b.phone || "",
    email: b.customer_email || b.email || "",
  },
  createdAt: b.created_at,
});

// GET /api/bookings/check-date
router.get("/check-date", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT event_date FROM bookings WHERE status != 'cancelled' AND event_date >= CURDATE()`
    );
    const bookedDates = rows.map((r) => String(r.event_date).slice(0, 10));
    return res.json({ bookedDates });
  } catch (error) {
    console.error("[BOOKINGS ERROR /check-date]", error);
    return res.status(500).json({ error: "Server error checking booked dates." });
  }
});

// GET /api/bookings
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { status, date } = req.query;
    let query = `
      SELECT b.*, 
             p.name AS package_name, p.code AS package_code,
             u.first_name, u.last_name, u.email, u.phone,
             (SELECT payment_method FROM payments WHERE booking_id = b.id ORDER BY id DESC LIMIT 1) AS payment_method,
             (SELECT status FROM payments WHERE booking_id = b.id ORDER BY id DESC LIMIT 1) AS payment_status,
             (SELECT COUNT(*) FROM reviews_feedback WHERE booking_id = b.id) AS has_feedback
      FROM bookings b
      JOIN packages p ON b.package_id = p.id
      JOIN customers c ON b.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by customer if logged in as customer
    if (req.user && req.user.role === "customer" && req.user.customerId) {
      query += ` AND b.customer_id = ?`;
      params.push(req.user.customerId);
    }

    if (status) {
      query += ` AND b.status = ?`;
      params.push(status);
    }

    if (date) {
      query += ` AND b.event_date = ?`;
      params.push(date);
    }

    query += ` ORDER BY b.event_date DESC, b.created_at DESC`;

    const [bookings] = await pool.query(query, params);

    // Fetch addons for each booking
    const [addons] = await pool.query(`
      SELECT ba.*, a.name, a.code AS addon_code, a.unit_type, a.icon, a.image_url
      FROM booking_addons ba
      JOIN addons a ON ba.addon_id = a.id
    `);

    const addonsByBooking = {};
    for (const a of addons) {
      if (!addonsByBooking[a.booking_id]) addonsByBooking[a.booking_id] = [];
      addonsByBooking[a.booking_id].push(a);
    }

    const formatted = bookings.map((b) =>
      formatBooking(
        {
          ...b,
          method: b.payment_method,
          rated: b.has_feedback > 0,
        },
        addonsByBooking[b.id] || [],
        { payment_method: b.payment_method, status: b.payment_status }
      )
    );

    return res.json({ bookings: formatted });
  } catch (error) {
    console.error("[BOOKINGS ERROR /]", error);
    return res.status(500).json({ error: "Server error fetching bookings." });
  }
});

// POST /api/bookings
router.post("/", optionalAuth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      ref,
      pkg,
      packageId,
      date,
      time,
      venue,
      guests,
      addons = [],
      total,
      deposit,
      balance,
      status = "confirmed",
      method = "GCash",
      customer = {},
    } = req.body;

    if (!pkg && !packageId) {
      return res.status(400).json({ error: "Package name or ID is required." });
    }
    if (!date || !time || !venue || !guests) {
      return res.status(400).json({ error: "Date, time, venue, and guest count are required." });
    }

    await connection.beginTransaction();

    // 1. Resolve Package
    const [packages] = await connection.query(
      `SELECT * FROM packages WHERE code = ? OR name = ? OR id = ? LIMIT 1`,
      [packageId || pkg, pkg || packageId, isNaN(packageId) ? -1 : Number(packageId)]
    );

    if (!packages.length) {
      await connection.rollback();
      return res.status(404).json({ error: `Package '${pkg || packageId}' not found.` });
    }
    const packageRow = packages[0];

    // 2. Resolve Customer
    let customerId = req.user?.customerId || null;
    let userId = req.user?.id || null;

    if (!customerId) {
      // Find or create customer from customer object
      const custName = customer.name?.trim() || "Zion Guest";
      const custEmail = customer.email?.trim() || "";
      const custPhone = customer.phone?.trim() || "";

      // Check existing user
      let [existingUsers] = await connection.query(
        `SELECT u.id, c.id AS customer_id 
         FROM users u
         LEFT JOIN customers c ON c.user_id = u.id
         WHERE (u.email != '' AND u.email = ?) OR (u.phone != '' AND u.phone = ?)
         LIMIT 1`,
        [custEmail || "---", custPhone || "---"]
      );

      if (existingUsers.length && existingUsers[0].customer_id) {
        userId = existingUsers[0].id;
        customerId = existingUsers[0].customer_id;
      } else {
        // Split name
        const parts = custName.split(/\s+/);
        const last = parts.length > 1 ? parts.pop() : "";
        const first = parts.join(" ") || "Guest";

        // Create user with default random hash
        const [newUser] = await connection.query(
          `INSERT INTO users (first_name, last_name, email, phone, password_hash, role)
           VALUES (?, ?, ?, ?, '$2b$10$dp730rD9wgtY4BzTXv.SQe2LtMp1UEJpHioERxEAJFj.3FGKZSdO6', 'customer')`,
          [first, last, custEmail || null, custPhone || null]
        );
        userId = newUser.insertId;

        const [newCust] = await connection.query(
          `INSERT INTO customers (user_id, address, city, province) VALUES (?, ?, 'Tagbilaran City', 'Bohol')`,
          [userId, venue]
        );
        customerId = newCust.insertId;
      }
    }

    // 3. Generate Booking Reference
    const bookingRef = ref || `ZFC-${Math.floor(200000 + Math.random() * 800000)}`;

    const guestCount = Number(guests);
    if (!Number.isInteger(guestCount) || guestCount < Number(packageRow.min_guests)) {
      await connection.rollback();
      return res.status(400).json({
        error: `Guest count must be a whole number of at least ${packageRow.min_guests}.`,
      });
    }
    const pkgSubtotal = Number(packageRow.price_per_head) * guestCount;

    // 4. Insert Booking
    const [bookingResult] = await connection.query(
      `INSERT INTO bookings (
        booking_reference, customer_id, package_id, event_name, event_date, event_time,
        venue_name, venue_address, guest_count, package_subtotal, addons_subtotal,
        total_amount, deposit_amount, balance_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bookingRef,
        customerId,
        packageRow.id,
        packageRow.name,
        date,
        time.length === 5 ? `${time}:00` : time,
        venue,
        venue,
        guestCount,
        pkgSubtotal,
        0,
        pkgSubtotal,
        Math.round(pkgSubtotal / 2),
        pkgSubtotal - Math.round(pkgSubtotal / 2),
        status,
      ]
    );

    const bookingId = bookingResult.insertId;

    // 5. Insert Addons if any
    const insertedAddons = [];
    let addonsSubtotal = 0;
    if (Array.isArray(addons) && addons.length) {
      for (const addonItem of addons) {
        const addonIdentifier = addonItem.id || addonItem.code || addonItem.name;
        const [addonRows] = await connection.query(
          `SELECT * FROM addons WHERE code = ? OR name = ? OR id = ? LIMIT 1`,
          [addonIdentifier, addonIdentifier, isNaN(addonIdentifier) ? -1 : Number(addonIdentifier)]
        );

        if (addonRows.length) {
          const a = addonRows[0];
          const qty = Number(addonItem.quantity || addonItem.qty || 1);
          const unitPrice = Number(a.price);
          const lineTotal = (a.unit_type === "per_head" ? unitPrice * guestCount : unitPrice) * qty;

          await connection.query(
            `INSERT INTO booking_addons (booking_id, addon_id, quantity, unit_price, line_total)
             VALUES (?, ?, ?, ?, ?)`,
            [bookingId, a.id, qty, unitPrice, lineTotal]
          );

          insertedAddons.push({
            ...a,
            quantity: qty,
            unit_price: unitPrice,
          });
          addonsSubtotal += lineTotal;
        }
      }
    }

    const calcTotal = pkgSubtotal + addonsSubtotal;
    const calcDeposit = Math.round(calcTotal / 2);
    const calcBalance = calcTotal - calcDeposit;
    await connection.query(
      `UPDATE bookings SET addons_subtotal = ?, total_amount = ?, deposit_amount = ?, balance_amount = ? WHERE id = ?`,
      [addonsSubtotal, calcTotal, calcDeposit, calcBalance, bookingId]
    );

    // 6. Record Initial Deposit Payment
    const paymentMethod = method || "GCash";
    const paymentStatus = paymentMethod === "Cash on Delivery" ? "pending" : "verified";
    await connection.query(
      `INSERT INTO payments (booking_id, payment_type, payment_method, amount, reference_number, status)
       VALUES (?, 'deposit', ?, ?, ?, ?)`,
      [bookingId, paymentMethod, calcDeposit, `${bookingRef}-DEP`, paymentStatus]
    );

    // 7. Auto-Generate Standard Event Prep Checklist for Staff
    const defaultTasks = [
      { title: `Prepare catering ingredients for ${guestCount} pax`, stage: "preparing" },
      { title: "Pack chafing dishes, service ware, and table skirts", stage: "ready" },
      { title: `Deliver to venue: ${venue}`, stage: "delivery" },
      { title: "Setup buffet styling and food warmers", stage: "delivery" },
      { title: "Conduct full banquet service and dish replenishment", stage: "served" },
      { title: "Post-event pack-down and venue turnover", stage: "served" },
    ];

    for (const t of defaultTasks) {
      await connection.query(
        `INSERT INTO event_tasks (booking_id, title, stage, status) VALUES (?, ?, ?, 'pending')`,
        [bookingId, t.title, t.stage]
      );
    }

    await connection.commit();

    const createdBooking = formatBooking(
      {
        booking_reference: bookingRef,
        id: bookingId,
        package_name: packageRow.name,
        package_code: packageRow.code,
        event_date: date,
        event_time: time,
        venue_address: venue,
        guest_count: guestCount,
        total_amount: calcTotal,
        deposit_amount: calcDeposit,
        balance_amount: calcBalance,
        status,
        rated: false,
        created_at: new Date().toISOString(),
      },
      insertedAddons,
      { payment_method: paymentMethod, status: paymentStatus }
    );

    return res.status(201).json({ booking: createdBooking });
  } catch (error) {
    await connection.rollback();
    console.error("[BOOKINGS ERROR / POST]", error);
    return res.status(500).json({ error: "Server error creating booking." });
  } finally {
    connection.release();
  }
});

// GET /api/bookings/:ref
router.get("/:ref", async (req, res) => {
  try {
    const { ref } = req.params;
    const [bookings] = await pool.query(
      `SELECT b.*, 
              p.name AS package_name, p.code AS package_code,
              u.first_name, u.last_name, u.email, u.phone,
              (SELECT payment_method FROM payments WHERE booking_id = b.id ORDER BY id DESC LIMIT 1) AS payment_method,
              (SELECT status FROM payments WHERE booking_id = b.id ORDER BY id DESC LIMIT 1) AS payment_status
       FROM bookings b
       JOIN packages p ON b.package_id = p.id
       JOIN customers c ON b.customer_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE b.booking_reference = ? OR b.id = ?
       LIMIT 1`,
      [ref, isNaN(ref) ? -1 : Number(ref)]
    );

    if (!bookings.length) {
      return res.status(404).json({ error: "Booking not found." });
    }

    const b = bookings[0];

    const [addons] = await pool.query(
      `SELECT ba.*, a.name, a.code AS addon_code, a.unit_type, a.icon, a.image_url
       FROM booking_addons ba
       JOIN addons a ON ba.addon_id = a.id
       WHERE ba.booking_id = ?`,
      [b.id]
    );

    const [feedbackRows] = await pool.query(
      `SELECT rating, comment FROM reviews_feedback WHERE booking_id = ? LIMIT 1`,
      [b.id]
    );

    return res.json({
      booking: formatBooking(
        b,
        addons,
        { payment_method: b.payment_method, status: b.payment_status },
        feedbackRows[0] || null
      ),
    });
  } catch (error) {
    console.error("[BOOKINGS ERROR /:ref]", error);
    return res.status(500).json({ error: "Server error fetching booking." });
  }
});

// PATCH /api/bookings/:ref (Update Status)
router.patch("/:ref", async (req, res) => {
  try {
    const { ref } = req.params;
    const { status } = req.body;
    const allowed = ["confirmed", "preparing", "ready", "delivery", "served", "cancelled"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status.", allowed });
    }

    const [result] = await pool.query(
      `UPDATE bookings SET status = ?, updated_at = NOW() WHERE booking_reference = ? OR id = ?`,
      [status, ref, isNaN(ref) ? -1 : Number(ref)]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Booking not found." });
    }

    // Fetch updated
    const [updated] = await pool.query(
      `SELECT b.*, p.name AS package_name, p.code AS package_code 
       FROM bookings b 
       JOIN packages p ON b.package_id = p.id
       WHERE b.booking_reference = ? OR b.id = ? LIMIT 1`,
      [ref, isNaN(ref) ? -1 : Number(ref)]
    );

    return res.json({ booking: formatBooking(updated[0]) });
  } catch (error) {
    console.error("[BOOKINGS ERROR PATCH /:ref]", error);
    return res.status(500).json({ error: "Server error updating booking status." });
  }
});

// DELETE /api/bookings/:ref
router.delete("/:ref", async (req, res) => {
  try {
    const { ref } = req.params;
    const [result] = await pool.query(
      `DELETE FROM bookings WHERE booking_reference = ? OR id = ?`,
      [ref, isNaN(ref) ? -1 : Number(ref)]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Booking not found." });
    }

    return res.json({ ok: true, message: `Booking ${ref} successfully removed.` });
  } catch (error) {
    console.error("[BOOKINGS ERROR DELETE /:ref]", error);
    return res.status(500).json({ error: "Server error deleting booking." });
  }
});

// POST /api/bookings/:ref/feedback (Customer Review & Rating)
router.post("/:ref/feedback", optionalAuth, async (req, res) => {
  try {
    const { ref } = req.params;
    const { stars, comment } = req.body;

    const ratingNum = Number(stars);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "Rating must be an integer between 1 and 5." });
    }

    const [bookings] = await pool.query(
      `SELECT id, customer_id FROM bookings WHERE booking_reference = ? OR id = ? LIMIT 1`,
      [ref, isNaN(ref) ? -1 : Number(ref)]
    );

    if (!bookings.length) {
      return res.status(404).json({ error: "Booking not found." });
    }

    const booking = bookings[0];
    await pool.query(
      `INSERT INTO reviews_feedback (booking_id, customer_id, rating, comment)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
      [booking.id, booking.customer_id, ratingNum, comment || ""]
    );

    return res.json({ ok: true, message: "Feedback submitted successfully." });
  } catch (error) {
    console.error("[BOOKINGS ERROR feedback]", error);
    return res.status(500).json({ error: "Server error saving feedback." });
  }
});

module.exports = router;

