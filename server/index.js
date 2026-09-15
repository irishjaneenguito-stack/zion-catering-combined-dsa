const express = require("express");
const cors = require("cors");
const path = require("node:path");
require("dotenv").config();

const pool = require("./config/db");
const authRoutes = require("./routes/auth");
const packagesRoutes = require("./routes/packages");
const addonsRoutes = require("./routes/addons");
const bookingsRoutes = require("./routes/bookings");
const customersRoutes = require("./routes/customers");
const adminRoutes = require("./routes/admin");
const staffRoutes = require("./routes/staff");
const contactRoutes = require("./routes/contact");

const app = express();
const PORT = Number(process.env.API_PORT || 4000);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/health", async (req, res) => {
  try {
    const [result] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, service: "zion-catering-api", database: "mysql-connected" });
  } catch (error) {
    res.status(500).json({ ok: false, service: "zion-catering-api", database: error.message });
  }
});

// Mount Modular API Routes
app.use("/api/auth", authRoutes);
app.use("/api/packages", packagesRoutes);
app.use("/api/addons", addonsRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/contact", contactRoutes);

// Backward compatibility: GET /api/users & POST /api/users (used in existing mobile app)
app.get("/api/users", async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS name, u.email, u.phone, u.role, u.created_at AS createdAt 
       FROM users u ORDER BY u.created_at DESC`
    );
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { name = "", phone = "", email = "" } = req.body;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const parts = name.trim().split(/\s+/);
    const last = parts.length > 1 ? parts.pop() : "";
    const first = parts.join(" ") || "Guest";

    // Check if exists
    const [existing] = await pool.query(
      `SELECT u.id FROM users u WHERE (u.email != '' AND u.email = ?) OR (u.phone != '' AND u.phone = ?) LIMIT 1`,
      [cleanEmail || "---", cleanPhone || "---"]
    );

    if (existing.length) {
      return res.json({ user: { id: existing[0].id, name: name.trim(), email: cleanEmail, phone: cleanPhone } });
    }

    const [insertResult] = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, role)
       VALUES (?, ?, ?, ?, '$2b$10$dp730rD9wgtY4BzTXv.SQe2LtMp1UEJpHioERxEAJFj.3FGKZSdO6', 'customer')`,
      [first, last, cleanEmail || null, cleanPhone || null]
    );

    const userId = insertResult.insertId;
    await pool.query(`INSERT INTO customers (user_id) VALUES (?)`, [userId]);

    return res.status(201).json({
      user: { id: userId, name: name.trim(), email: cleanEmail, phone: cleanPhone },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve Web Admin Application
const webPath = path.join(__dirname, "..", "web", "dist");
app.use("/web", express.static(webPath));
app.use("/web", (req, res) => {
  res.sendFile(path.join(webPath, "index.html"));
});

const adminPath = path.join(__dirname, "public", "admin");
app.use("/admin", express.static(adminPath));
app.use("/admin", (req, res) => {
  res.sendFile(path.join(adminPath, "index.html"));
});

// Serve Web Staff Application
const staffPath = path.join(__dirname, "public", "staff");
app.use("/staff", express.static(staffPath));
app.use("/staff", (req, res) => {
  res.sendFile(path.join(staffPath, "index.html"));
});

// Root route redirect to /admin
app.get("/", (req, res) => {
  res.redirect("/admin");
});

// Start listening
const server = app.listen(PORT, () => {
  console.log(`Zion Catering Unified Backend running at http://localhost:${PORT}`);
  console.log(`- Web Admin Portal: http://localhost:${PORT}/admin`);
  console.log(`- Web Staff Portal: http://localhost:${PORT}/staff`);
  console.log(`- REST API Endpoints: http://localhost:${PORT}/api`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is in use. Please terminate existing process or choose another port.`);
  } else {
    console.error("Server error:", error);
  }
});

module.exports = app;
