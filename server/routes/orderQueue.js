/**
 * Order Queue Routes — REST API Integration for OrderQueue Min-Heap
 * CS 211 - Data Structures and Algorithms
 * Group 09: Irish Jane B. Enguito (heap), Riza Mae C. Micayabas (route integration)
 *
 * This route layer connects the OrderQueue min-heap (server/orderQueue.js)
 * to the REST API through Express endpoints.
 *
 * Endpoints:
 *   POST   /api/order-queue           — Enqueue a new order (authenticated)
 *   POST   /api/order-queue/walk-in   — Enqueue a walk-in order (staff/admin only)
 *   GET    /api/order-queue/dequeue   — Dequeue highest-priority order (staff/admin only)
 *   GET    /api/order-queue/peek      — Peek at highest-priority order without removing (authenticated)
 *   GET    /api/order-queue           — View current queue state (staff/admin only)
 */

const express = require("express");
const { authenticateToken, requireRole } = require("../middleware/auth");
const OrderQueue = require("../orderQueue");

const router = express.Router();

// Single shared in-memory queue instance for this server process
const orderQueue = new OrderQueue();

// -----------------------------------------------------------------------
// POST /api/order-queue — Enqueue a new catering order (any authenticated user)
// Input:  { customer, priority?, details? }
// Output: 201 { success, message, order, queueSize }
// -----------------------------------------------------------------------
router.post("/", authenticateToken, (req, res) => {
  try {
    const { customer, priority, details } = req.body;

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required.",
      });
    }

    // Priority: 1 = VIP, 2 = Regular (default)
    const orderPriority = priority === 1 ? 1 : 2;

    const order = {
      id: Date.now(), // simple unique id
      customer,
      priority: orderPriority,
      priorityLabel: orderPriority === 1 ? "VIP" : "Regular",
      details: details || null,
      createdBy: req.user.name || req.user.email,
      createdAt: new Date().toISOString(),
    };

    orderQueue.enqueue(order, orderPriority);

    return res.status(201).json({
      success: true,
      message: "Order enqueued successfully.",
      order,
      queueSize: orderQueue.size(),
    });
  } catch (error) {
    console.error("[ORDER-QUEUE ERROR /enqueue]", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// -----------------------------------------------------------------------
// POST /api/order-queue/walk-in — Enqueue a walk-in order (staff/admin only)
// Input:  { customer, priority?, details? }
// Output: 201 { success, message, order, queueSize }
// -----------------------------------------------------------------------
router.post("/walk-in", authenticateToken, requireRole("staff", "admin"), (req, res) => {
  try {
    const { customer, priority, details } = req.body;

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required.",
      });
    }

    const orderPriority = priority === 1 ? 1 : 2;

    const order = {
      id: Date.now(),
      customer,
      priority: orderPriority,
      priorityLabel: orderPriority === 1 ? "VIP" : "Regular",
      details: details || null,
      type: "walk-in",
      createdBy: req.user.name || req.user.email,
      createdAt: new Date().toISOString(),
    };

    orderQueue.enqueue(order, orderPriority);

    return res.status(201).json({
      success: true,
      message: "Walk-in order enqueued successfully.",
      order,
      queueSize: orderQueue.size(),
    });
  } catch (error) {
    console.error("[ORDER-QUEUE ERROR /walk-in]", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// -----------------------------------------------------------------------
// GET /api/order-queue/dequeue — Dequeue highest-priority order (staff/admin)
// Output: 200 { success, order, queueSize } or 404 if empty
// -----------------------------------------------------------------------
router.get("/dequeue", authenticateToken, requireRole("staff", "admin"), (req, res) => {
  try {
    if (orderQueue.isEmpty()) {
      return res.status(404).json({
        success: false,
        message: "Queue is empty. No orders to process.",
      });
    }

    const order = orderQueue.dequeue();

    return res.json({
      success: true,
      message: "Order dequeued for processing.",
      order,
      queueSize: orderQueue.size(),
    });
  } catch (error) {
    console.error("[ORDER-QUEUE ERROR /dequeue]", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// -----------------------------------------------------------------------
// GET /api/order-queue/peek — Peek at highest-priority order (authenticated)
// Output: 200 { success, order, queueSize } or 404 if empty
// -----------------------------------------------------------------------
router.get("/peek", authenticateToken, (req, res) => {
  try {
    if (orderQueue.isEmpty()) {
      return res.status(404).json({
        success: false,
        message: "Queue is empty.",
      });
    }

    const top = orderQueue.peek();

    return res.json({
      success: true,
      order: top.order,
      priority: top.priority,
      queueSize: orderQueue.size(),
    });
  } catch (error) {
    console.error("[ORDER-QUEUE ERROR /peek]", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// -----------------------------------------------------------------------
// GET /api/order-queue — View full queue snapshot (staff/admin only)
// Output: 200 { success, queue[], queueSize }
// -----------------------------------------------------------------------
router.get("/", authenticateToken, requireRole("staff", "admin"), (req, res) => {
  try {
    // Return a copy of the heap array (read-only snapshot)
    const snapshot = orderQueue.heap.map((node) => ({
      order: node.order,
      priority: node.priority,
      priorityLabel: node.priority === 1 ? "VIP" : "Regular",
      timestamp: node.timestamp,
    }));

    return res.json({
      success: true,
      queue: snapshot,
      queueSize: orderQueue.size(),
      isEmpty: orderQueue.isEmpty(),
    });
  } catch (error) {
    console.error("[ORDER-QUEUE ERROR /list]", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;
