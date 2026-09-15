const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { JWT_SECRET, authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Helper to split full name into first and last name
const splitName = (fullName = "") => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0] || "User", last: "" };
  const last = parts.pop();
  const first = parts.join(" ");
  return { first, last };
};

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, phone, username, password } = req.body;
    const loginIdentifier = (email || phone || username || "").trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: "Email/phone and password are required." });
    }

    // Query user by email or phone
    const [users] = await pool.query(
      `SELECT * FROM users WHERE (email = ? OR phone = ?) AND status = 'active' LIMIT 1`,
      [loginIdentifier, loginIdentifier]
    );

    if (!users.length) {
      return res.status(401).json({ error: "Invalid credentials or account is inactive." });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Fetch role-specific profiles
    let customerProfile = null;
    let staffProfile = null;

    if (user.role === "customer") {
      const [customers] = await pool.query(`SELECT * FROM customers WHERE user_id = ? LIMIT 1`, [user.id]);
      customerProfile = customers[0] || null;
    } else if (user.role === "staff") {
      const [staff] = await pool.query(`SELECT * FROM staff_profiles WHERE user_id = ? LIMIT 1`, [user.id]);
      staffProfile = staff[0] || null;
    }

    const fullName = `${user.first_name} ${user.last_name}`.trim();
    const tokenPayload = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      name: fullName,
      customerId: customerProfile?.id || null,
      staffId: staffProfile?.id || null,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      token,
      user: {
        id: user.id,
        name: fullName,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatar_url,
        customerProfile,
        staffProfile,
      },
    });
  } catch (error) {
    console.error("[AUTH ERROR /login]", error);
    return res.status(500).json({ error: "Server error during authentication." });
  }
});

// POST /api/auth/register (Customer registration)
router.post("/register", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { name, email, phone, password, address, city } = req.body;

    if (!password || password.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters long." });
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPhone = (phone || "").trim();

    if (!cleanEmail && !cleanPhone) {
      return res.status(400).json({ error: "Email address or mobile phone is required." });
    }

    // Check duplicate
    const [existing] = await connection.query(
      `SELECT id, email, phone FROM users WHERE (email != '' AND email = ?) OR (phone != '' AND phone = ?) LIMIT 1`,
      [cleanEmail || "---", cleanPhone || "---"]
    );

    if (existing.length) {
      return res.status(409).json({ error: "An account with this email or phone number already exists." });
    }

    const { first, last } = splitName(name || "Customer");
    const passwordHash = await bcrypt.hash(password, 10);

    await connection.beginTransaction();

    const [userResult] = await connection.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, 'customer', 'active')`,
      [first, last, cleanEmail || null, cleanPhone || null, passwordHash]
    );

    const userId = userResult.insertId;

    const [customerResult] = await connection.query(
      `INSERT INTO customers (user_id, address, city, province)
       VALUES (?, ?, ?, 'Bohol')`,
      [userId, address || "", city || "Tagbilaran City"]
    );

    const customerId = customerResult.insertId;

    await connection.commit();

    const fullName = `${first} ${last}`.trim();
    const token = jwt.sign(
      {
        id: userId,
        email: cleanEmail,
        phone: cleanPhone,
        role: "customer",
        name: fullName,
        customerId,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      token,
      user: {
        id: userId,
        customerId,
        name: fullName,
        firstName: first,
        lastName: last,
        email: cleanEmail,
        phone: cleanPhone,
        role: "customer",
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error("[AUTH ERROR /register]", error);
    return res.status(500).json({ error: "Server error during registration." });
  } finally {
    connection.release();
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT id, first_name, last_name, email, phone, role, status, avatar_url, created_at FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = users[0];
    let customerProfile = null;
    let staffProfile = null;

    if (user.role === "customer") {
      const [c] = await pool.query(`SELECT * FROM customers WHERE user_id = ?`, [user.id]);
      customerProfile = c[0] || null;
    } else if (user.role === "staff") {
      const [s] = await pool.query(`SELECT * FROM staff_profiles WHERE user_id = ?`, [user.id]);
      staffProfile = s[0] || null;
    }

    return res.json({
      user: {
        ...user,
        name: `${user.first_name} ${user.last_name}`.trim(),
        customerProfile,
        staffProfile,
      },
    });
  } catch (error) {
    console.error("[AUTH ERROR /me]", error);
    return res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;

