const mysql = require("mysql2/promise");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });

const databaseName = process.env.DB_NAME || "zion_catering_services";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: databaseName,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: true,
});

// Test connection on startup
pool.getConnection()
  .then((conn) => {
    console.log(`[DB] Connected to MySQL database: ${databaseName}`);
    conn.release();
  })
  .catch((err) => {
    console.error("[DB ERROR] Failed to connect to MySQL database:", err.message);
  });

module.exports = pool;
