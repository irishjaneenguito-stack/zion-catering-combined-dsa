const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// GET /api/contact
router.get("/", async (req, res) => {
  try {
    const [contacts] = await pool.query(
      `SELECT id, name, email, phone, message, status, created_at AS createdAt FROM contact_inquiries ORDER BY created_at DESC`
    );
    return res.json({ contacts });
  } catch (error) {
    console.error("[CONTACT ERROR /]", error);
    return res.status(500).json({ error: "Server error fetching inquiries." });
  }
});

// POST /api/contact
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !message) {
      return res.status(400).json({ error: "Name and message are required." });
    }

    const [result] = await pool.query(
      `INSERT INTO contact_inquiries (name, email, phone, message, status) VALUES (?, ?, ?, ?, 'unread')`,
      [name.trim(), (email || "").trim(), (phone || "").trim(), message.trim()]
    );

    return res.status(201).json({
      message: {
        id: result.insertId,
        name: name.trim(),
        email: email || "",
        phone: phone || "",
        message: message.trim(),
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[CONTACT ERROR POST /]", error);
    return res.status(500).json({ error: "Server error submitting inquiry." });
  }
});

module.exports = router;

