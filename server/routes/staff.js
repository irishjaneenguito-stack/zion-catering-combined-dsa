const express = require("express");
const pool = require("../config/db");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken, requireRole("staff", "admin"));

// GET /api/staff/dashboard
router.get("/dashboard", authenticateToken, async (req, res) => {
  try {
    const staffId = req.user.staffId;

    // Fetch assigned events for today and future
    let eventsQuery = `
      SELECT b.id, b.booking_reference, b.event_date, b.event_time, b.venue_address,
             b.guest_count, b.status, p.name AS package_name, esa.assigned_role,
             u.firstName AS customer_first, u.lastName AS customer_last, u.phone AS customer_phone
      FROM event_staff_assignments esa
      JOIN bookings b ON esa.booking_id = b.id
      JOIN packages p ON b.package_id = p.id
      JOIN customers c ON b.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE esa.staff_profile_id = ? AND b.status != 'cancelled'
      ORDER BY b.event_date ASC, b.event_time ASC
    `;
    const [assignedEvents] = await pool.query(eventsQuery, [staffId || 1]);

    // Fetch tasks for these events
    const [tasks] = await pool.query(
      `SELECT et.*, b.booking_reference 
       FROM event_tasks et
       JOIN bookings b ON et.booking_id = b.id
       WHERE et.staff_profile_id = ? OR et.staff_profile_id IS NULL
       ORDER BY et.due_time ASC, et.id ASC`,
      [staffId || 1]
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayEvents = assignedEvents.filter((e) => String(e.event_date).slice(0, 10) === todayStr);

    return res.json({
      staffMember: {
        id: staffId,
        name: req.user.name,
        role: req.user.role,
      },
      todayEvents,
      upcomingEvents: assignedEvents,
      tasks,
    });
  } catch (error) {
    console.error("[STAFF ERROR /dashboard]", error);
    return res.status(500).json({ error: "Server error fetching staff dashboard." });
  }
});

// GET /api/staff/events
router.get("/events", authenticateToken, async (req, res) => {
  try {
    const staffId = req.user.staffId || 1;
    const { all } = req.query;

    let query = `
      SELECT b.*, p.name AS package_name, p.code AS package_code,
             u.firstName AS first_name, u.lastName AS last_name, u.phone, u.email,
             esa.assigned_role, esa.status AS assignment_status
      FROM bookings b
      JOIN packages p ON b.package_id = p.id
      JOIN customers c ON b.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN event_staff_assignments esa ON esa.booking_id = b.id AND esa.staff_profile_id = ?
      WHERE 1=1
    `;
    const params = [staffId];

    if (!all) {
      query += ` AND (esa.staff_profile_id = ? OR b.event_date >= CURDATE())`;
      params.push(staffId);
    }

    query += ` ORDER BY b.event_date ASC, b.event_time ASC`;

    const [bookings] = await pool.query(query, params);

    const formatted = bookings.map((b) => ({
      id: b.id,
      ref: b.booking_reference,
      package: b.package_name,
      date: String(b.event_date).slice(0, 10),
      time: String(b.event_time).slice(0, 5),
      venue: b.venue_address,
      guests: b.guest_count,
      status: b.status,
      assignedRole: b.assigned_role || "On-Duty Staff",
      customer: {
        name: `${b.first_name} ${b.last_name}`.trim(),
        phone: b.phone || "No phone",
      },
    }));

    return res.json({ events: formatted });
  } catch (error) {
    console.error("[STAFF ERROR /events]", error);
    return res.status(500).json({ error: "Server error fetching staff events." });
  }
});

// GET /api/staff/events/:ref
router.get("/events/:ref", authenticateToken, async (req, res) => {
  try {
    const { ref } = req.params;
    const [bookings] = await pool.query(
      `SELECT b.*, p.name AS package_name, p.code AS package_code,
              u.firstName AS first_name, u.lastName AS last_name, u.phone, u.email
       FROM bookings b
       JOIN packages p ON b.package_id = p.id
       JOIN customers c ON b.customer_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE b.booking_reference = ? OR b.id = ? LIMIT 1`,
      [ref, isNaN(ref) ? -1 : Number(ref)]
    );

    if (!bookings.length) {
      return res.status(404).json({ error: "Event not found." });
    }

    const b = bookings[0];

    // Inclusions
    const [inclusions] = await pool.query(
      `SELECT item_text FROM package_inclusions WHERE package_id = ? ORDER BY sort_order ASC`,
      [b.package_id]
    );

    // Addons
    const [addons] = await pool.query(
      `SELECT ba.quantity, ba.unit_price, a.name, a.unit_type
       FROM booking_addons ba
       JOIN addons a ON ba.addon_id = a.id
       WHERE ba.booking_id = ?`,
      [b.id]
    );

    // Tasks
    const [tasks] = await pool.query(
      `SELECT * FROM event_tasks WHERE booking_id = ? ORDER BY id ASC`,
      [b.id]
    );

    return res.json({
      event: {
        id: b.id,
        ref: b.booking_reference,
        packageName: b.package_name,
        date: String(b.event_date).slice(0, 10),
        time: String(b.event_time).slice(0, 5),
        venue: b.venue_address,
        guests: b.guest_count,
        status: b.status,
        customer: {
          name: `${b.first_name} ${b.last_name}`.trim(),
          phone: b.phone,
          email: b.email,
        },
        inclusions: inclusions.map((i) => i.item_text),
        addons: addons.map((a) => ({
          name: a.name,
          quantity: a.quantity,
          unit: a.unit_type === "per_head" ? "per head" : "flat",
        })),
        tasks,
      },
    });
  } catch (error) {
    console.error("[STAFF ERROR /events/:ref]", error);
    return res.status(500).json({ error: "Server error fetching event details." });
  }
});

// PATCH /api/staff/tasks/:id (Toggle or set task status)
router.patch("/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const [tasks] = await pool.query(`SELECT status FROM event_tasks WHERE id = ? LIMIT 1`, [id]);
    if (!tasks.length) {
      return res.status(404).json({ error: "Task not found." });
    }

    const nextStatus = status || (tasks[0].status === "completed" ? "pending" : "completed");
    const completedAt = nextStatus === "completed" ? "NOW()" : "NULL";

    await pool.query(
      `UPDATE event_tasks SET status = ?, completed_at = ${completedAt} WHERE id = ?`,
      [nextStatus, id]
    );

    return res.json({ ok: true, status: nextStatus });
  } catch (error) {
    console.error("[STAFF ERROR PATCH /tasks/:id]", error);
    return res.status(500).json({ error: "Server error updating task." });
  }
});

// PATCH /api/staff/events/:ref/status (Advance event status)
router.patch("/events/:ref/status", authenticateToken, async (req, res) => {
  try {
    const { ref } = req.params;
    const { status } = req.body;

    const allowed = ["preparing", "ready", "delivery", "served"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Status must be one of: " + allowed.join(", ") });
    }

    const [result] = await pool.query(
      `UPDATE bookings SET status = ?, updated_at = NOW() WHERE booking_reference = ? OR id = ?`,
      [status, ref, isNaN(ref) ? -1 : Number(ref)]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Event not found." });
    }

    return res.json({ ok: true, status });
  } catch (error) {
    console.error("[STAFF ERROR PATCH status]", error);
    return res.status(500).json({ error: "Server error updating event status." });
  }
});

module.exports = router;
