const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "zion_catering_services",
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: true,
});

// Test connection on startup
pool.getConnection()
  .then((conn) => {
    console.log("[DB] Connected to MySQL database: zion_catering_services");
    conn.release();
  })
  .catch((err) => {
    console.error("[DB ERROR] Failed to connect to MySQL database:", err.message);
  });

module.exports = pool;

