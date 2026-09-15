// Zion Catering Services - Web Admin Suite
const peso = (n) => `PHP ${Number(n || 0).toLocaleString("en-PH")}`;
const dateFmt = (d) => (d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "N/A");

const state = {
  token: localStorage.getItem("zion_admin_token") || null,
  user: JSON.parse(localStorage.getItem("zion_admin_user") || "null"),
  bookings: [],
  customers: [],
  staff: [],
  packages: [],
  payments: [],
  inquiries: [],
  stats: null,
  activeTab: "dashboard",
};

// API Helper
const api = async (endpoint, options = {}) => {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
  }

  const res = await fetch(endpoint, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

// Authentication & Session
const checkAuth = () => {
  const modal = document.getElementById("loginModal");
  if (!state.token || !state.user || state.user.role !== "admin") {
    modal.style.display = "grid";
  } else {
    modal.style.display = "none";
    document.getElementById("adminName").textContent = state.user.name || "Administrator";
    const initials = (state.user.name || "AD").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
    document.getElementById("adminInitials").textContent = initials;
  }
};

document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorDiv = document.getElementById("loginError");
  errorDiv.style.display = "none";

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (data.user.role !== "admin") {
      throw new Error("This account is not authorized for the Admin Suite. Please log in with admin credentials.");
    }

    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("zion_admin_token", data.token);
    localStorage.setItem("zion_admin_user", JSON.stringify(data.user));

    checkAuth();
    loadAllData();
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.style.display = "block";
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  if (confirm("Sign out of Zion Catering Admin Suite?")) {
    state.token = null;
    state.user = null;
    localStorage.removeItem("zion_admin_token");
    localStorage.removeItem("zion_admin_user");
    checkAuth();
  }
});

// Navigation Tabs
const switchTab = (tab) => {
  state.activeTab = tab;
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });
  document.querySelectorAll(".content-view").forEach((el) => {
    el.style.display = el.id === `view-${tab}` ? "flex" : "none";
  });

  const titles = {
    dashboard: "Operations Dashboard",
    bookings: "Bookings & Event Reservations",
    customers: "Customer Accounts & History",
    staff: "Catering Crew & Staff Management",
    packages: "Catering Packages & Menu Configuration",
    payments: "Payments & Invoices",
    reports: "Business Reports & Analytics",
    inquiries: "Customer Inquiries & Messages",
  };
  document.getElementById("pageTitle").textContent = titles[tab] || "Admin Suite";
};

document.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    switchTab(el.dataset.tab);
  });
});

// Render Functions
const renderStats = (stats) => {
  if (!stats) return;
  document.getElementById("statBookings").textContent = stats.bookingCount;
  document.getElementById("statRevenue").textContent = peso(stats.revenueTotal);
  document.getElementById("statCustomers").textContent = stats.customerCount;
  document.getElementById("statStaff").textContent = stats.staffCount;

  // Breakdown list
  const breakdown = document.getElementById("statusBreakdown");
  const labels = {
    confirmed: "Confirmed",
    preparing: "Preparing food",
    ready: "Packed & ready",
    delivery: "On the way",
    served: "Completed service",
    cancelled: "Cancelled",
  };

  breakdown.innerHTML = Object.entries(stats.statusCounts)
    .map(
      ([k, v]) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 13px;">
        <span class="badge badge-${k}">${labels[k] || k}</span>
        <strong>${v} events</strong>
      </div>
    `
    )
    .join("");
};

const renderDashboardBookings = (bookings) => {
  const tbody = document.getElementById("dashboardBookingsBody");
  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--muted);">No bookings found in database.</td></tr>';
    return;
  }

  tbody.innerHTML = bookings.slice(0, 5).map((b) => `
    <tr>
      <td><strong>${b.ref}</strong></td>
      <td>${b.customer.name}<div style="font-size: 11px; color: var(--muted);">${b.customer.phone || b.customer.email}</div></td>
      <td>${b.pkg}</td>
      <td>${b.date} <span style="font-size:11.5px; color:var(--muted);">${b.time}</span></td>
      <td>${b.guests} pax</td>
      <td><strong>${peso(b.total)}</strong></td>
      <td><span class="badge badge-${b.status}">${b.status}</span></td>
      <td><button class="btn btn-sm btn-secondary" onclick="openBookingDrawer('${b.ref}')">Details</button></td>
    </tr>
  `).join("");
};

const renderAllBookings = (bookings) => {
  const tbody = document.getElementById("allBookingsBody");
  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 32px; color: var(--muted);">No bookings match your filter.</td></tr>';
    return;
  }

  const statusOpts = ["confirmed", "preparing", "ready", "delivery", "served", "cancelled"];

  tbody.innerHTML = bookings.map((b) => {
    const options = statusOpts.map((s) => `<option value="${s}" ${b.status === s ? "selected" : ""}>${s}</option>`).join("");
    const staffList = b.assignedStaff.length ? b.assignedStaff.map((s) => s.name).join(", ") : "<span style='color:var(--muted); font-size:11.5px;'>Unassigned</span>";

    return `
      <tr>
        <td><strong>${b.ref}</strong><div style="font-size:11px; color:var(--muted);">${dateFmt(b.createdAt)}</div></td>
        <td>
          <strong>${b.customer.name}</strong>
          <div style="font-size: 11.5px; color: var(--muted);">${b.customer.phone || "No phone"}</div>
          <div style="font-size: 11px; color: var(--muted);">${b.customer.email || ""}</div>
        </td>
        <td>
          <strong>${b.pkg}</strong>
          <div style="font-size:11.5px; color:var(--muted);">${b.guests} guests</div>
          ${b.addons.length ? `<div style="font-size:11px; color:var(--pink);">${b.addons.map((a) => `${a.name} x${a.quantity}`).join(", ")}</div>` : ""}
        </td>
        <td>
          <strong>${b.date}</strong>
          <div style="font-size:11.5px; color:var(--muted);">${b.time}</div>
        </td>
        <td style="max-width: 180px; font-size:12px;">${b.venue}</td>
        <td>
          <strong>${peso(b.total)}</strong>
          <div style="font-size:11px; color:var(--muted);">Dep: ${peso(b.deposit)}</div>
        </td>
        <td>
          <select class="select-filter" style="padding: 4px 8px; font-size: 12px;" onchange="updateBookingStatus('${b.ref}', this.value)">
            ${options}
          </select>
        </td>
        <td>
          <div style="margin-bottom: 4px; font-size: 12px;">${staffList}</div>
          <button class="btn btn-sm btn-ghost" onclick="openAssignModal('${b.ref}', '${b.pkg}')">+ Assign</button>
        </td>
        <td>
          <div style="display:flex; gap: 6px;">
            <button class="btn btn-sm btn-secondary" onclick="openBookingDrawer('${b.ref}')">View</button>
            <button class="btn btn-sm btn-danger" onclick="deleteBooking('${b.ref}')">&times;</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
};

const renderCustomers = (customers) => {
  const tbody = document.getElementById("customersTableBody");
  if (!customers.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--muted);">No customer accounts found.</td></tr>';
    return;
  }

  tbody.innerHTML = customers.map((c) => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.email}</td>
      <td>${c.phone}</td>
      <td style="font-size:12px;">${c.address}</td>
      <td><strong>${c.totalBookings}</strong></td>
      <td><strong style="color:var(--pink);">${peso(c.totalSpent)}</strong></td>
      <td style="font-size:12px; color:var(--muted);">${dateFmt(c.createdAt)}</td>
    </tr>
  `).join("");
};

const renderStaff = (staff) => {
  const tbody = document.getElementById("staffTableBody");
  if (!staff.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--muted);">No staff members found.</td></tr>';
    return;
  }

  tbody.innerHTML = staff.map((s) => `
    <tr>
      <td><strong>${s.name}</strong></td>
      <td>${s.position}</td>
      <td><span class="badge badge-subtle" style="text-transform:uppercase;">${s.department}</span></td>
      <td>
        <div>${s.phone || "No phone"}</div>
        <div style="font-size:11px; color:var(--muted);">${s.email || "No email"}</div>
      </td>
      <td><span class="badge ${s.status === "available" ? "badge-served" : "badge-confirmed"}">${s.status}</span></td>
      <td><strong>${s.activeAssignments}</strong> active</td>
      <td><button class="btn btn-sm btn-secondary" onclick="alert('Staff ID: ${s.id}\\nPosition: ${s.position}\\nHired: ${s.hireDate}')">Details</button></td>
    </tr>
  `).join("");
};

const renderPackages = (packages) => {
  const grid = document.getElementById("packagesGrid");
  if (!packages.length) {
    grid.innerHTML = '<div style="color:var(--muted); text-align:center;">No packages found.</div>';
    return;
  }

  grid.innerHTML = packages.map((p) => `
    <div class="pkg-admin-card">
      <img src="${p.imageUrl || "https://images.unsplash.com/photo-1536489885071-87983c3e2859?w=500"}" class="pkg-admin-img" alt="${p.name}" />
      <div class="pkg-admin-body">
        <div class="pkg-admin-head">
          <div>
            <span class="badge badge-primary">${p.category}</span>
            <div class="pkg-admin-title" style="margin-top: 4px;">${p.name}</div>
          </div>
          <span class="badge ${p.isActive ? "badge-served" : "badge-cancelled"}">${p.isActive ? "Active" : "Inactive"}</span>
        </div>
        <div style="font-size: 12px; color: var(--muted);">${p.tagline}</div>
        <div class="pkg-admin-meta">
          <strong>${peso(p.pricePerHead)} / head</strong>
          <span>Min ${p.minGuests} pax</span>
        </div>
        <ul class="pkg-admin-inc">
          ${p.includes.map((i) => `<li>&bull; ${i}</li>`).join("")}
        </ul>
        <div style="margin-top: auto; padding-top: 12px;">
          <button class="btn btn-sm btn-secondary btn-block" onclick="openEditPackageModal(${p.id})">Edit Package</button>
        </div>
      </div>
    </div>
  `).join("");
};

const renderPayments = (payments) => {
  const tbody = document.getElementById("paymentsTableBody");
  if (!payments.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--muted);">No payment records found.</td></tr>';
    return;
  }

  tbody.innerHTML = payments.map((p) => `
    <tr>
      <td><strong>${p.bookingRef}</strong></td>
      <td>${p.customerName}</td>
      <td><span class="badge badge-subtle">${p.type}</span></td>
      <td><strong>${p.method}</strong></td>
      <td><strong style="color:var(--pink);">${peso(p.amount)}</strong></td>
      <td style="font-size:12px; font-family:monospace;">${p.ref || "None"}</td>
      <td style="font-size:12px; color:var(--muted);">${dateFmt(p.date)}</td>
      <td><span class="badge ${p.status === "verified" ? "badge-served" : "badge-confirmed"}">${p.status}</span></td>
      <td>
        ${p.status !== "verified" ? `<button class="btn btn-sm btn-primary" onclick="verifyPayment(${p.id})">Verify</button>` : '<span style="color:var(--green); font-size:12px; font-weight:700;">Verified</span>'}
      </td>
    </tr>
  `).join("");
};

const renderReports = (reports) => {
  const rev = document.getElementById("monthlyRevenueReport");
  const pop = document.getElementById("packagePopularityReport");

  if (!reports || !reports.monthlyRevenue) return;

  rev.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Month</th><th>Bookings</th><th>Gross Total</th></tr></thead>
      <tbody>
        ${reports.monthlyRevenue.map((r) => `
          <tr>
            <td><strong>${r.month}</strong></td>
            <td>${r.bookingsCount} events</td>
            <td><strong style="color:var(--pink);">${peso(r.revenue)}</strong></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  pop.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Package</th><th>Events Booked</th><th>Revenue</th></tr></thead>
      <tbody>
        ${reports.packagePopularity.map((p) => `
          <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.total_bookings || 0}</td>
            <td><strong>${peso(p.total_revenue || 0)}</strong></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
};

const renderInquiries = (inquiries) => {
  const dash = document.getElementById("dashboardInquiries");
  const full = document.getElementById("allInquiriesList");
  const badge = document.getElementById("unreadInquiriesBadge");

  const unreadCount = inquiries.filter((i) => i.status === "unread").length;
  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }

  const renderCard = (i) => `
    <div class="inquiry-card ${i.status === "unread" ? "unread" : ""}">
      <div class="inquiry-head">
        <strong>${i.name}</strong>
        <span style="color:var(--muted);">${dateFmt(i.createdAt)}</span>
      </div>
      <div class="inquiry-msg">${i.message}</div>
      <div class="inquiry-meta">${i.email ? `Email: ${i.email} &bull; ` : ""}${i.phone ? `Phone: ${i.phone}` : ""}</div>
    </div>
  `;

  if (dash) {
    dash.innerHTML = inquiries.slice(0, 3).map(renderCard).join("") || '<div style="color:var(--muted); font-size:12.5px;">No inquiries yet.</div>';
  }
  if (full) {
    full.innerHTML = inquiries.map(renderCard).join("") || '<div style="color:var(--muted); font-size:13px; text-align:center; padding:30px;">No messages received yet.</div>';
  }
};

// Data Actions
const updateBookingStatus = async (ref, status) => {
  try {
    await api(`/api/admin/bookings/${encodeURIComponent(ref)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadAllData();
  } catch (err) {
    alert("Error updating status: " + err.message);
  }
};

const deleteBooking = async (ref) => {
  if (!confirm(`Are you sure you want to delete/cancel booking ${ref}?`)) return;
  try {
    await api(`/api/admin/bookings/${encodeURIComponent(ref)}`, { method: "DELETE" });
    await loadAllData();
  } catch (err) {
    alert("Error deleting booking: " + err.message);
  }
};

const verifyPayment = async (id) => {
  try {
    await api(`/api/admin/payments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "verified" }),
    });
    await loadAllData();
  } catch (err) {
    alert("Error verifying payment: " + err.message);
  }
};

// Modals
window.openBookingDrawer = (ref) => {
  const b = state.bookings.find((item) => item.ref === ref);
  if (!b) return;

  document.getElementById("drawerRef").textContent = b.ref;
  document.getElementById("drawerPackage").textContent = b.pkg;

  const staffText = b.assignedStaff.length
    ? b.assignedStaff.map((s) => `&bull; ${s.name} (${s.position}) - Role: ${s.role}`).join("<br/>")
    : "No crew assigned yet";

  const addonsText = b.addons.length
    ? b.addons.map((a) => `&bull; ${a.name} x${a.quantity} (${peso(a.total)})`).join("<br/>")
    : "No add-ons selected";

  document.getElementById("drawerContent").innerHTML = `
    <div>
      <h4 style="font-size:14px; text-transform:uppercase; color:var(--muted);">Customer Details</h4>
      <div style="font-size:14px; font-weight:700; margin-top:4px;">${b.customer.name}</div>
      <div style="font-size:13px; color:var(--muted);">${b.customer.phone || "No phone"} &bull; ${b.customer.email || "No email"}</div>
    </div>
    <div style="border-top: 1px solid var(--line); padding-top: 12px;">
      <h4 style="font-size:14px; text-transform:uppercase; color:var(--muted);">Schedule & Venue</h4>
      <div style="font-size:13.5px; font-weight:600; margin-top:4px;">${b.date} at ${b.time}</div>
      <div style="font-size:13px; color:var(--muted); margin-top:2px;">${b.venue}</div>
      <div style="font-size:13px; color:var(--muted); margin-top:2px;">Guests: <strong>${b.guests} pax</strong></div>
    </div>
    <div style="border-top: 1px solid var(--line); padding-top: 12px;">
      <h4 style="font-size:14px; text-transform:uppercase; color:var(--muted);">Selected Add-ons</h4>
      <div style="font-size:13px; margin-top:4px;">${addonsText}</div>
    </div>
    <div style="border-top: 1px solid var(--line); padding-top: 12px;">
      <h4 style="font-size:14px; text-transform:uppercase; color:var(--muted);">Financials</h4>
      <div style="display:flex; justify-content:space-between; font-size:13px; margin-top:4px;">
        <span>Total Booking Amount:</span><strong>${peso(b.total)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:13px;">
        <span>50% Deposit:</span><strong>${peso(b.deposit)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:13px;">
        <span>Balance Due:</span><strong>${peso(b.balance)}</strong>
      </div>
    </div>
    <div style="border-top: 1px solid var(--line); padding-top: 12px;">
      <h4 style="font-size:14px; text-transform:uppercase; color:var(--muted);">Assigned Catering Crew</h4>
      <div style="font-size:13px; margin-top:4px;">${staffText}</div>
      <button class="btn btn-sm btn-ghost mt-4" onclick="openAssignModal('${b.ref}', '${b.pkg}')">+ Assign More Staff</button>
    </div>
  `;

  document.getElementById("bookingDrawer").style.display = "grid";
};

document.getElementById("closeDrawerBtn").addEventListener("click", () => {
  document.getElementById("bookingDrawer").style.display = "none";
});

window.openAssignModal = (ref, pkgName) => {
  document.getElementById("assignBookingRef").value = ref;
  document.getElementById("assignBookingDisplay").value = `${ref} - ${pkgName}`;

  const select = document.getElementById("assignStaffSelect");
  select.innerHTML = state.staff.map((s) => `<option value="${s.id}">${s.name} (${s.position} - ${s.department})</option>`).join("");

  document.getElementById("assignModal").style.display = "grid";
};

document.getElementById("closeAssignModalBtn").addEventListener("click", () => {
  document.getElementById("assignModal").style.display = "none";
});

document.getElementById("assignStaffForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const ref = document.getElementById("assignBookingRef").value;
  const staffProfileId = document.getElementById("assignStaffSelect").value;
  const assignedRole = document.getElementById("assignRoleInput").value.trim();
  const shiftStart = document.getElementById("assignShiftStart").value;
  const shiftEnd = document.getElementById("assignShiftEnd").value;

  try {
    await api(`/api/admin/bookings/${encodeURIComponent(ref)}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ staffProfileId, assignedRole, shiftStart, shiftEnd }),
    });
    alert("Staff member successfully assigned to event!");
    document.getElementById("assignModal").style.display = "none";
    await loadAllData();
  } catch (err) {
    alert("Error assigning staff: " + err.message);
  }
});

// Add Staff Modal
document.getElementById("openAddStaffBtn").addEventListener("click", () => {
  document.getElementById("addStaffModal").style.display = "grid";
});
document.getElementById("closeAddStaffBtn").addEventListener("click", () => {
  document.getElementById("addStaffModal").style.display = "none";
});

document.getElementById("addStaffForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const firstName = document.getElementById("newStaffFirst").value.trim();
  const lastName = document.getElementById("newStaffLast").value.trim();
  const email = document.getElementById("newStaffEmail").value.trim();
  const phone = document.getElementById("newStaffPhone").value.trim();
  const position = document.getElementById("newStaffPosition").value.trim();
  const department = document.getElementById("newStaffDept").value;
  const password = document.getElementById("newStaffPassword").value;

  try {
    await api("/api/admin/staff", {
      method: "POST",
      body: JSON.stringify({ firstName, lastName, email, phone, position, department, password }),
    });
    alert("Staff member added successfully!");
    document.getElementById("addStaffModal").style.display = "none";
    document.getElementById("addStaffForm").reset();
    await loadAllData();
  } catch (err) {
    alert("Error creating staff member: " + err.message);
  }
});

// Edit Package Modal
window.openEditPackageModal = (id) => {
  const pkg = state.packages.find((p) => p.id === id);
  if (!pkg) return;

  document.getElementById("editPackageId").value = pkg.id;
  document.getElementById("editPackageTitle").textContent = `Edit ${pkg.name}`;
  document.getElementById("editPackagePrice").value = pkg.pricePerHead;
  document.getElementById("editPackageMin").value = pkg.minGuests;
  document.getElementById("editPackageTagline").value = pkg.tagline;
  document.getElementById("editPackageActive").checked = pkg.isActive;

  document.getElementById("editPackageModal").style.display = "grid";
};

document.getElementById("closeEditPackageBtn").addEventListener("click", () => {
  document.getElementById("editPackageModal").style.display = "none";
});

document.getElementById("editPackageForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("editPackageId").value;
  const pricePerHead = Number(document.getElementById("editPackagePrice").value);
  const minGuests = Number(document.getElementById("editPackageMin").value);
  const tagline = document.getElementById("editPackageTagline").value.trim();
  const isActive = document.getElementById("editPackageActive").checked ? 1 : 0;

  try {
    await api(`/api/admin/packages/${id}`, {
      method: "PUT",
      body: JSON.stringify({ pricePerHead, minGuests, tagline, isActive }),
    });
    alert("Package updated successfully!");
    document.getElementById("editPackageModal").style.display = "none";
    await loadAllData();
  } catch (err) {
    alert("Error updating package: " + err.message);
  }
});

// Search & Filter
document.getElementById("bookingSearch").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase().trim();
  const filtered = state.bookings.filter(
    (b) =>
      b.ref.toLowerCase().includes(query) ||
      b.customer.name.toLowerCase().includes(query) ||
      b.venue.toLowerCase().includes(query) ||
      b.pkg.toLowerCase().includes(query)
  );
  renderAllBookings(filtered);
});

document.getElementById("bookingStatusFilter").addEventListener("change", (e) => {
  const status = e.target.value;
  const filtered = status === "all" ? state.bookings : state.bookings.filter((b) => b.status === status);
  renderAllBookings(filtered);
});

// Refresh Button
document.getElementById("refreshBtn").addEventListener("click", () => {
  loadAllData();
});

// Main Data Fetcher
const loadAllData = async () => {
  try {
    const [statsData, bookingsData, customersData, staffData, packagesData, paymentsData, reportsData, inquiriesData] =
      await Promise.all([
        api("/api/admin/dashboard-stats"),
        api("/api/admin/bookings"),
        api("/api/admin/customers"),
        api("/api/admin/staff"),
        api("/api/admin/packages"),
        api("/api/admin/payments"),
        api("/api/admin/reports"),
        api("/api/contact"),
      ]);

    state.stats = statsData;
    state.bookings = bookingsData.bookings || [];
    state.customers = customersData.customers || [];
    state.staff = staffData.staff || [];
    state.packages = packagesData.packages || [];
    state.payments = paymentsData.payments || [];
    state.inquiries = inquiriesData.contacts || [];

    renderStats(state.stats);
    renderDashboardBookings(state.bookings);
    renderAllBookings(state.bookings);
    renderCustomers(state.customers);
    renderStaff(state.staff);
    renderPackages(state.packages);
    renderPayments(state.payments);
    renderReports(reportsData);
    renderInquiries(state.inquiries);

    document.getElementById("dbStatus").textContent = "Connected";
    document.getElementById("dbStatus").className = "status-indicator online";
  } catch (err) {
    console.error("Load error:", err);
    document.getElementById("dbStatus").textContent = "Connection Error";
    document.getElementById("dbStatus").className = "status-indicator offline";
  }
};

// Initial Load
checkAuth();
if (state.token && state.user && state.user.role === "admin") {
  loadAllData();
}

