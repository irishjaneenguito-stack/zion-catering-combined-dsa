/**
 * OrderQueue Route Integration Tests
 * CS 211 - Data Structures and Algorithms
 * Group 09: Riza Mae C. Micayabas (route integration & tests)
 *
 * Framework: Node.js built-in Test Runner (node --test)
 * Run: node --test server/test/orderQueue.test.js
 *
 * These tests verify the OrderQueue min-heap integration with Express routes.
 * Tests cover: authentication, role authorization, enqueue, dequeue, peek,
 * VIP priority ordering, empty queue handling, and walk-in orders.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

// --- Mock JWT for testing (bypasses real database) ---
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/auth");

// Generate test tokens for different roles
const makeToken = (role, name = "Test User") =>
  jwt.sign({ id: 1, email: `${role}@test.com`, role, name }, JWT_SECRET, { expiresIn: "1h" });

const customerToken = makeToken("customer", "Regular Client A");
const staffToken = makeToken("staff", "Staff Member");
const adminToken = makeToken("admin", "Admin User");

// --- Helper: make HTTP request to the running server ---
function request(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 4000,
      path,
      method,
      headers: { "Content-Type": "application/json" },
    };

    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// =====================================================================
// TEST SUITE: OrderQueue Route Integration
// =====================================================================
describe("OrderQueue Route Integration Tests", () => {

  // --- 1. Authentication Tests (No Token = 401) ---
  describe("1. Authentication — Unauthenticated requests return 401", () => {
    it("GET /api/order-queue without token → 401", async () => {
      const res = await request("GET", "/api/order-queue");
      assert.equal(res.status, 401);
    });

    it("POST /api/order-queue without token → 401", async () => {
      const res = await request("POST", "/api/order-queue", {
        body: { customer: "Test", priority: 2 },
      });
      assert.equal(res.status, 401);
    });

    it("POST /api/order-queue/walk-in without token → 401", async () => {
      const res = await request("POST", "/api/order-queue/walk-in", {
        body: { customer: "Test", priority: 2 },
      });
      assert.equal(res.status, 401);
    });

    it("GET /api/order-queue/dequeue without token → 401", async () => {
      const res = await request("GET", "/api/order-queue/dequeue");
      assert.equal(res.status, 401);
    });

    it("GET /api/order-queue/peek without token → 401", async () => {
      const res = await request("GET", "/api/order-queue/peek");
      assert.equal(res.status, 401);
    });
  });

  // --- 2. Role Authorization Tests (Customer cannot dequeue) ---
  describe("2. Role Authorization — Customer token cannot dequeue", () => {
    it("GET /api/order-queue/dequeue with customer token → 403", async () => {
      const res = await request("GET", "/api/order-queue/dequeue", { token: customerToken });
      assert.equal(res.status, 403);
    });

    it("GET /api/order-queue (list) with customer token → 403", async () => {
      const res = await request("GET", "/api/order-queue", { token: customerToken });
      assert.equal(res.status, 403);
    });

    it("POST /api/order-queue/walk-in with customer token → 403", async () => {
      const res = await request("POST", "/api/order-queue/walk-in", {
        token: customerToken,
        body: { customer: "Test", priority: 2 },
      });
      assert.equal(res.status, 403);
    });
  });

  // --- 3. Enqueue Tests ---
  describe("3. Enqueue — Adding orders to the priority queue", () => {
    it("POST /api/order-queue with valid body → 201 + order enqueued", async () => {
      const res = await request("POST", "/api/order-queue", {
        token: customerToken,
        body: { customer: "Regular Client A", priority: 2 },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.order.customer, "Regular Client A");
      assert.equal(res.body.order.priorityLabel, "Regular");
      assert.ok(res.body.queueSize >= 1);
    });

    it("POST /api/order-queue VIP order → 201 + priority 1", async () => {
      const res = await request("POST", "/api/order-queue", {
        token: customerToken,
        body: { customer: "VIP Client B", priority: 1 },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.order.priority, 1);
      assert.equal(res.body.order.priorityLabel, "VIP");
    });

    it("POST /api/order-queue without customer → 400", async () => {
      const res = await request("POST", "/api/order-queue", {
        token: customerToken,
        body: { priority: 1 },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });

  // --- 4. Peek Test ---
  describe("4. Peek — View highest priority without removing", () => {
    it("GET /api/order-queue/peek → 200 + VIP order at top", async () => {
      const res = await request("GET", "/api/order-queue/peek", { token: customerToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.priority, 1); // VIP should be at top
    });
  });

  // --- 5. Dequeue Tests (VIP first) ---
  describe("5. Dequeue — Staff processes orders (VIP first)", () => {
    it("GET /api/order-queue/dequeue with staff token → 200 + VIP order", async () => {
      const res = await request("GET", "/api/order-queue/dequeue", { token: staffToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.order.priority, 1); // VIP dequeued first
      assert.equal(res.body.order.priorityLabel, "VIP");
    });

    it("Dequeue remaining → Regular order comes after VIP", async () => {
      const res = await request("GET", "/api/order-queue/dequeue", { token: staffToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.order.priority, 2); // Regular after VIP
    });
  });

  // --- 6. Empty Queue Test ---
  describe("6. Empty Queue — Dequeue on empty returns 404", () => {
    it("GET /api/order-queue/dequeue on empty queue → 404", async () => {
      const res = await request("GET", "/api/order-queue/dequeue", { token: staffToken });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /empty/i);
    });

    it("GET /api/order-queue/peek on empty queue → 404", async () => {
      const res = await request("GET", "/api/order-queue/peek", { token: customerToken });
      assert.equal(res.status, 404);
    });
  });

  // --- 7. Walk-in Order Test ---
  describe("7. Walk-in — Staff can enqueue walk-in orders", () => {
    it("POST /api/order-queue/walk-in with admin token → 201", async () => {
      const res = await request("POST", "/api/order-queue/walk-in", {
        token: adminToken,
        body: { customer: "Walk-in Client", priority: 2, details: "Walk-in customer" },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.order.type, "walk-in");
    });
  });
});
