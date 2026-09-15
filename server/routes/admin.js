const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken, requireRole("admin"));

// Helper to format booking
const formatAdminBooking = (b, addons = [], staff = [], payment = null) => ({
  id: b.id,
  ref: b.booking_reference,
  pkg: b.package_name,
  packageId: b.package_code,
  date: String(b.event_date || "").slice(0, 10),
  time: String(b.event_time || "").slice(0, 5),
  venue: b.venue_address,
  venueName: b.venue_name,
  guests: Number(b.guest_count || 0),
  total: Number(b.total_amount || 0),
  deposit: Number(b.deposit_amount || 0),
  balance: Number(b.balance_amount || 0),
  status: b.status || "confirmed",
  customer: {
    id: b.customer_id,
    name: `${b.first_name || ""} ${b.last_name || ""}`.trim() || "Guest",
    email: b.email || "",
    phone: b.phone || "",
  },
  addons,
  assignedStaff: staff,
  payment: payment
    ? {
        id: payment.id,
        method: payment.payment_method,
        status: payment.status,
        amount: Number(payment.amount),
        ref: payment.reference_number,
      }
    : null,
  createdAt: b.created_at,
});

// GET /api/admin/dashboard-stats
router.get("/dashboard-stats", async (req, res) => {
  try {
    const [[{ bookingCount, revenueTotal }]] = await pool.query(`
      SELECT COUNT(*) AS bookingCount, 
             COALESCE(SUM(total_amount), 0) AS revenueTotal 
      FROM bookings
    `);

    const [[{ customerCount }]] = await pool.query(`
      SELECT COUNT(*) AS customerCount FROM users WHERE role = 'customer'
    `);

    const [[{ staffCount }]] = await pool.query(`
      SELECT COUNT(*) AS staffCount FROM staff_profiles WHERE status != 'inactive'
    `);

    const [[{ messageCount }]] = await pool.query(`
      SELECT COUNT(*) AS messageCount FROM contact_inquiries
    `);

    const [[{ todayEvents }]] = await pool.query(`
      SELECT COUNT(*) AS todayEvents FROM bookings WHERE event_date = CURDATE() AND status != 'cancelled'
    `);

    const [statusRows] = await pool.query(`
      SELECT status, COUNT(*) AS count FROM bookings GROUP BY status
    `);

    const statusCounts = {
      confirmed: 0,
      preparing: 0,
      ready: 0,
      delivery: 0,
      served: 0,
      cancelled: 0,
    };
    for (const r of statusRows) {
      statusCounts[r.status] = Number(r.count);
    }

    return res.json({
      bookingCount: Number(bookingCount),
      revenueTotal: Number(revenueTotal),
      customerCount: Number(customerCount),
      staffCount: Number(staffCount),
      messageCount: Number(messageCount),
      todayEvents: Number(todayEvents),
      statusCounts,
    });
  } catch (error) {
    console.error("[ADMIN ERROR /dashboard-stats]", error);
    return res.status(500).json({ error: "Server error fetching stats." });
  }
});

// GET /api/admin/bookings
router.get("/bookings", async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT b.*, p.name AS package_name, p.code AS package_code,
             u.first_name, u.last_name, u.email, u.phone
      FROM bookings b
      JOIN packages p ON b.package_id = p.id
      JOIN customers c ON b.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== "all") {
      query += ` AND b.status = ?`;
      params.push(status);
    }

    if (search) {
      query += ` AND (b.booking_reference LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR b.venue_address LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY b.event_date DESC, b.created_at DESC`;

    const [bookings] = await pool.query(query, params);

    // Fetch all addons
    const [addons] = await pool.query(`
      SELECT ba.*, a.name, a.code, a.unit_type
      FROM booking_addons ba
      JOIN addons a ON ba.addon_id = a.id
    `);

    const addonsMap = {};
    for (const a of addons) {
      if (!addonsMap[a.booking_id]) addonsMap[a.booking_id] = [];
      addonsMap[a.booking_id].push({
        id: a.code,
        name: a.name,
        price: Number(a.unit_price),
        quantity: a.quantity,
        total: Number(a.line_total),
      });
    }

    // Fetch staff assignments
    const [assignments] = await pool.query(`
      SELECT esa.booking_id, esa.assigned_role, esa.status AS assign_status,
             u.first_name, u.last_name, sp.position, sp.id AS staff_profile_id
      FROM event_staff_assignments esa
      JOIN staff_profiles sp ON esa.staff_profile_id = sp.id
      JOIN users u ON sp.user_id = u.id
    `);

    const staffMap = {};
    for (const assign of assignments) {
      if (!staffMap[assign.booking_id]) staffMap[assign.booking_id] = [];
      staffMap[assign.booking_id].push({
        staffProfileId: assign.staff_profile_id,
        name: `${assign.first_name} ${assign.last_name}`.trim(),
        position: assign.position,
        role: assign.assigned_role,
        status: assign.assign_status,
      });
    }

    // Fetch payments
    const [payments] = await pool.query(`
      SELECT * FROM payments ORDER BY id DESC
    `);
    const paymentMap = {};
    for (const p of payments) {
      if (!paymentMap[p.booking_id]) paymentMap[p.booking_id] = p;
    }

    const formatted = bookings.map((b) =>
      formatAdminBooking(b, addonsMap[b.id] || [], staffMap[b.id] || [], paymentMap[b.id] || null)
    );

    return res.json({ bookings: formatted });
  } catch (error) {
    console.error("[ADMIN ERROR /bookings]", error);
    return res.status(500).json({ error: "Server error fetching admin bookings." });
  }
});

// PATCH /api/admin/bookings/:ref/assign (Assign Staff to Booking)
router.patch("/bookings/:ref/assign", async (req, res) => {
  try {
    const { ref } = req.params;
    const { staffProfileId, assignedRole, shiftStart, shiftEnd } = req.body;

    const [bookings] = await pool.query(
      `SELECT id FROM bookings WHERE booking_reference = ? OR id = ? LIMIT 1`,
      [ref, isNaN(ref) ? -1 : Number(ref)]
    );

    if (!bookings.length) {
      return res.status(404).json({ error: "Booking not found." });
    }

    const bookingId = bookings[0].id;

    await pool.query(
      `INSERT INTO event_staff_assignments (booking_id, staff_profile_id, assigned_role, shift_start, shift_end, status)
       VALUES (?, ?, ?, ?, ?, 'assigned')`,
      [bookingId, staffProfileId, assignedRole || "Catering Staff", shiftStart || null, shiftEnd || null]
    );

    return res.json({ ok: true, message: "Staff assigned successfully." });
  } catch (error) {
    console.error("[ADMIN ERROR /bookings/:ref/assign]", error);
    return res.status(500).json({ error: "Server error assigning staff." });
  }
});

// GET /api/admin/staff (Staff directory)
router.get("/staff", async (req, res) => {
  try {
    const [staff] = await pool.query(`
      SELECT sp.id, sp.user_id, sp.position, sp.department, sp.status, sp.hire_date,
             u.first_name, u.last_name, u.email, u.phone,
             (SELECT COUNT(*) FROM event_staff_assignments WHERE staff_profile_id = sp.id AND status = 'assigned') AS active_assignments
      FROM staff_profiles sp
      JOIN users u ON sp.user_id = u.id
      ORDER BY sp.department ASC, u.first_name ASC
    `);

    const formatted = staff.map((s) => ({
      id: s.id,
      userId: s.user_id,
      name: `${s.first_name} ${s.last_name}`.trim(),
      email: s.email,
      phone: s.phone,
      position: s.position,
      department: s.department,
      status: s.status,
      hireDate: s.hire_date,
      activeAssignments: Number(s.active_assignments || 0),
    }));

    return res.json({ staff: formatted });
  } catch (error) {
    console.error("[ADMIN ERROR /staff]", error);
    return res.status(500).json({ error: "Server error fetching staff." });
  }
});

// POST /api/admin/staff (Create Staff member)
router.post("/staff", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { firstName, lastName, email, phone, password, position, department } = req.body;

    if (!firstName || !position || !password) {
      return res.status(400).json({ error: "First name, position, and initial password are required." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await connection.beginTransaction();

    const [userRes] = await connection.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, 'staff', 'active')`,
      [firstName.trim(), (lastName || "").trim(), (email || "").trim() || null, (phone || "").trim() || null, passwordHash]
    );

    const [staffRes] = await connection.query(
      `INSERT INTO staff_profiles (user_id, position, department, status, hire_date)
       VALUES (?, ?, ?, 'available', CURDATE())`,
      [userRes.insertId, position.trim(), department || "service"]
    );

    await connection.commit();
    return res.status(201).json({ ok: true, staffId: staffRes.insertId });
  } catch (error) {
    await connection.rollback();
    console.error("[ADMIN ERROR POST /staff]", error);
    return res.status(500).json({ error: "Server error creating staff member." });
  } finally {
    connection.release();
  }
});

// GET /api/admin/customers
router.get("/customers", async (req, res) => {
  try {
    const [customers] = await pool.query(`
      SELECT c.id, c.user_id, c.address, c.city, c.province,
             u.first_name, u.last_name, u.email, u.phone, u.created_at,
             COUNT(b.id) AS total_bookings,
             COALESCE(SUM(b.total_amount), 0) AS total_spent
      FROM customers c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN bookings b ON b.customer_id = c.id
      GROUP BY c.id
      ORDER BY total_spent DESC, u.created_at DESC
    `);

    const formatted = customers.map((c) => ({
      id: c.id,
      userId: c.user_id,
      name: `${c.first_name} ${c.last_name}`.trim(),
      email: c.email || "No email",
      phone: c.phone || "No phone",
      address: `${c.address ? c.address + ", " : ""}${c.city}, ${c.province}`,
      totalBookings: Number(c.total_bookings),
      totalSpent: Number(c.total_spent),
      createdAt: c.created_at,
    }));

    return res.json({ customers: formatted });
  } catch (error) {
    console.error("[ADMIN ERROR /customers]", error);
    return res.status(500).json({ error: "Server error fetching customers." });
  }
});

// GET /api/admin/packages & POST & PUT
router.get("/packages", async (req, res) => {
  try {
    const [packages] = await pool.query(`SELECT * FROM packages ORDER BY id ASC`);
    const [inclusions] = await pool.query(`SELECT * FROM package_inclusions ORDER BY sort_order ASC`);

    const incMap = {};
    for (const inc of inclusions) {
      if (!incMap[inc.package_id]) incMap[inc.package_id] = [];
      incMap[inc.package_id].push(inc.item_text);
    }

    const formatted = packages.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      pricePerHead: Number(p.price_per_head),
      minGuests: Number(p.min_guests),
      tagline: p.tagline,
      rating: Number(p.rating),
      badge: p.badge,
      imageUrl: p.image_url,
      isActive: Boolean(p.is_active),
      includes: incMap[p.id] || [],
    }));

    return res.json({ packages: formatted });
  } catch (error) {
    console.error("[ADMIN ERROR /packages]", error);
    return res.status(500).json({ error: "Server error fetching packages." });
  }
});

// PUT /api/admin/packages/:id (Edit package price/min/status)
router.put("/packages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { pricePerHead, minGuests, isActive, name, tagline } = req.body;

    await pool.query(
      `UPDATE packages 
       SET price_per_head = COALESCE(?, price_per_head),
           min_guests = COALESCE(?, min_guests),
           is_active = COALESCE(?, is_active),
           name = COALESCE(?, name),
           tagline = COALESCE(?, tagline)
       WHERE id = ?`,
      [pricePerHead, minGuests, isActive, name, tagline, id]
    );

    return res.json({ ok: true, message: "Package updated successfully." });
  } catch (error) {
    console.error("[ADMIN ERROR PUT /packages/:id]", error);
    return res.status(500).json({ error: "Server error updating package." });
  }
});

// GET /api/admin/payments
router.get("/payments", async (req, res) => {
  try {
    const [payments] = await pool.query(`
      SELECT p.*, b.booking_reference, b.event_date,
             u.first_name, u.last_name
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN customers c ON b.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      ORDER BY p.payment_date DESC
    `);

    const formatted = payments.map((p) => ({
      id: p.id,
      bookingRef: p.booking_reference,
      customerName: `${p.first_name} ${p.last_name}`.trim(),
      type: p.payment_type,
      method: p.payment_method,
      amount: Number(p.amount),
      ref: p.reference_number,
      status: p.status,
      date: p.payment_date,
      notes: p.notes,
    }));

    return res.json({ payments: formatted });
  } catch (error) {
    console.error("[ADMIN ERROR /payments]", error);
    return res.status(500).json({ error: "Server error fetching payments." });
  }
});

// PATCH /api/admin/payments/:id (Verify or reject payment)
router.patch("/payments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["verified", "pending", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid payment status." });
    }

    await pool.query(`UPDATE payments SET status = ? WHERE id = ?`, [status, id]);
    return res.json({ ok: true, message: `Payment status updated to ${status}.` });
  } catch (error) {
    console.error("[ADMIN ERROR PATCH /payments/:id]", error);
    return res.status(500).json({ error: "Server error updating payment." });
  }
});

// GET /api/admin/reports (Revenue & package popularity)
router.get("/reports", async (req, res) => {
  try {
    const [monthlyRevenue] = await pool.query(`
      SELECT DATE_FORMAT(event_date, '%Y-%m') AS month,
             COUNT(*) AS bookingsCount,
             COALESCE(SUM(total_amount), 0) AS revenue
      FROM bookings
      WHERE status != 'cancelled'
      GROUP BY DATE_FORMAT(event_date, '%Y-%m')
      ORDER BY month ASC
    `);

    const [packagePopularity] = await pool.query(`
      SELECT p.name, COUNT(b.id) AS total_bookings, COALESCE(SUM(b.total_amount), 0) AS total_revenue
      FROM packages p
      LEFT JOIN bookings b ON b.package_id = p.id AND b.status != 'cancelled'
      GROUP BY p.id
      ORDER BY total_bookings DESC
    `);

    return res.json({
      monthlyRevenue,
      packagePopularity,
    });
  } catch (error) {
    console.error("[ADMIN ERROR /reports]", error);
    return res.status(500).json({ error: "Server error generating reports." });
  }
});

module.exports = router;

