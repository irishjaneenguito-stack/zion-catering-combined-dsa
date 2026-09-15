const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// GET /api/addons
router.get("/", async (req, res) => {
  try {
    const [addons] = await pool.query(
      `SELECT * FROM addons WHERE is_active = 1 ORDER BY price ASC`
    );

    const formatted = addons.map((a) => ({
      id: a.code,
      dbId: a.id,
      name: a.name,
      price: Number(a.price),
      unit: a.unit_type === "per_head" ? "per head" : "flat",
      icon: a.icon || "sparkles-outline",
      img: a.image_url || "",
    }));

    return res.json({ addons: formatted });
  } catch (error) {
    console.error("[ADDONS ERROR /]", error);
    return res.status(500).json({ error: "Server error fetching addons." });
  }
});

module.exports = router;

