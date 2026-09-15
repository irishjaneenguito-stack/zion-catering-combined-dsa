const express = require("express");
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// GET /api/customers/me
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id AS user_id, u.first_name, u.last_name, u.email, u.phone,
              c.id AS customer_id, c.alt_phone, c.address, c.city, c.province
       FROM users u
       LEFT JOIN customers c ON c.user_id = u.id
       WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Customer not found." });
    }

    const row = rows[0];
    return res.json({
      customer: {
        userId: row.user_id,
        customerId: row.customer_id,
        name: `${row.first_name} ${row.last_name}`.trim(),
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        altPhone: row.alt_phone,
        address: row.address,
        city: row.city,
        province: row.province,
      },
    });
  } catch (error) {
    console.error("[CUSTOMERS ERROR /me]", error);
    return res.status(500).json({ error: "Server error fetching customer profile." });
  }
});

// GET /api/customers/venues (Saved Venues)
router.get("/venues", authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.customerId;
    if (!customerId) {
      return res.json({ venues: [] });
    }

    const [venues] = await pool.query(
      `SELECT id, name, address, created_at FROM customer_saved_venues WHERE customer_id = ? ORDER BY id DESC`,
      [customerId]
    );

    return res.json({ venues });
  } catch (error) {
    console.error("[CUSTOMERS ERROR /venues]", error);
    return res.status(500).json({ error: "Server error fetching saved venues." });
  }
});

// POST /api/customers/venues (Add Saved Venue)
router.post("/venues", authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const { name, address } = req.body;

    if (!name || !address) {
      return res.status(400).json({ error: "Venue name and address are required." });
    }

    const [result] = await pool.query(
      `INSERT INTO customer_saved_venues (customer_id, name, address) VALUES (?, ?, ?)`,
      [customerId, name.trim(), address.trim()]
    );

    return res.status(201).json({
      venue: { id: result.insertId, name: name.trim(), address: address.trim() },
    });
  } catch (error) {
    console.error("[CUSTOMERS ERROR POST /venues]", error);
    return res.status(500).json({ error: "Server error saving venue." });
  }
});

// DELETE /api/customers/venues/:id
router.delete("/venues/:id", authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const { id } = req.params;

    await pool.query(
      `DELETE FROM customer_saved_venues WHERE id = ? AND customer_id = ?`,
      [id, customerId]
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error("[CUSTOMERS ERROR DELETE /venues/:id]", error);
    return res.status(500).json({ error: "Server error deleting venue." });
  }
});

module.exports = router;

