const jwt = require("jsonwebtoken");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });

const JWT_SECRET = process.env.JWT_SECRET || "zion_catering_super_secret_jwt_key_2026";

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. Authentication token required." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token." });
  }
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // Ignore invalid token in optional mode
    }
  }
  next();
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized. Authentication required." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden. Role '${req.user.role}' is not authorized for this resource. Required: ${allowedRoles.join(", ")}`,
      });
    }
    next();
  };
};

module.exports = {
  JWT_SECRET,
  authenticateToken,
  optionalAuth,
  requireRole,
};
