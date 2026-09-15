const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// Helper to format package for frontend compatibility
const formatPackage = (pkg, inclusions = [], addons = []) => ({
  id: pkg.code,
  dbId: pkg.id,
  name: pkg.name,
  category: pkg.category,
  icon: pkg.icon,
  price: Number(pkg.price_per_head),
  min: Number(pkg.min_guests),
  tagline: pkg.tagline,
  rating: Number(pkg.rating),
  img: pkg.image_url,
  badge: pkg.badge || "",
  includes: inclusions.map((inc) => (typeof inc === "string" ? inc : inc.item_text)),
  addons: addons.map(formatAddon),
});

// Helper to format addon for frontend compatibility
const formatAddon = (addon) => ({
  id: addon.code,
  dbId: addon.id,
  name: addon.name,
  price: Number(addon.price),
  unit: addon.unit_type === "per_head" ? "per head" : "flat",
  icon: addon.icon || "sparkles-outline",
  img: addon.image_url || "",
});

// GET /api/packages
router.get("/", async (req, res) => {
  try {
    const [packages] = await pool.query(
      `SELECT * FROM packages WHERE is_active = 1 ORDER BY id ASC`
    );

    const [inclusions] = await pool.query(
      `SELECT package_id, item_text FROM package_inclusions ORDER BY sort_order ASC, id ASC`
    );

    const [addonLinks] = await pool.query(`
      SELECT pal.package_id, a.* 
      FROM package_addon_links pal
      JOIN addons a ON pal.addon_id = a.id
      WHERE a.is_active = 1
    `);

    // Group inclusions and addons by package_id
    const incMap = {};
    for (const inc of inclusions) {
      if (!incMap[inc.package_id]) incMap[inc.package_id] = [];
      incMap[inc.package_id].push(inc.item_text);
    }

    const addonMap = {};
    for (const link of addonLinks) {
      if (!addonMap[link.package_id]) addonMap[link.package_id] = [];
      addonMap[link.package_id].push(link);
    }

    const formatted = packages.map((pkg) =>
      formatPackage(pkg, incMap[pkg.id] || [], addonMap[pkg.id] || [])
    );

    return res.json({ packages: formatted });
  } catch (error) {
    console.error("[PACKAGES ERROR /]", error);
    return res.status(500).json({ error: "Server error fetching packages." });
  }
});

// GET /api/packages/:id (Supports 'wed', 'bday', or numeric database id)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [packages] = await pool.query(
      `SELECT * FROM packages WHERE (code = ? OR id = ?) AND is_active = 1 LIMIT 1`,
      [id, isNaN(id) ? -1 : Number(id)]
    );

    if (!packages.length) {
      return res.status(404).json({ error: "Package not found." });
    }

    const pkg = packages[0];
    const [inclusions] = await pool.query(
      `SELECT item_text FROM package_inclusions WHERE package_id = ? ORDER BY sort_order ASC`,
      [pkg.id]
    );

    const [addons] = await pool.query(
      `SELECT a.* FROM addons a
       JOIN package_addon_links pal ON a.id = pal.addon_id
       WHERE pal.package_id = ? AND a.is_active = 1`,
      [pkg.id]
    );

    return res.json({
      package: formatPackage(pkg, inclusions, addons),
    });
  } catch (error) {
    console.error("[PACKAGES ERROR /:id]", error);
    return res.status(500).json({ error: "Server error fetching package." });
  }
});

// GET /api/packages/:id/addons
router.get("/:id/addons", async (req, res) => {
  try {
    const { id } = req.params;
    const [packages] = await pool.query(
      `SELECT id FROM packages WHERE code = ? OR id = ? LIMIT 1`,
      [id, isNaN(id) ? -1 : Number(id)]
    );

    if (!packages.length) {
      return res.status(404).json({ error: "Package not found." });
    }

    const [addons] = await pool.query(
      `SELECT a.* FROM addons a
       JOIN package_addon_links pal ON a.id = pal.addon_id
       WHERE pal.package_id = ? AND a.is_active = 1`,
      [packages[0].id]
    );

    return res.json({ addons: addons.map(formatAddon) });
  } catch (error) {
    console.error("[PACKAGES ERROR /:id/addons]", error);
    return res.status(500).json({ error: "Server error fetching package addons." });
  }
});

module.exports = router;

