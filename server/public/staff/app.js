// Zion Catering Services - Web Staff Operations Portal
const peso = (n) => `PHP ${Number(n || 0).toLocaleString("en-PH")}`;
const dateFmt = (d) => (d ? new Date(d).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" }) : "N/A");

const state = {
  token: localStorage.getItem("zion_staff_token") || null,
  user: JSON.parse(localStorage.getItem("zion_staff_user") || "null"),
  dashboardData: null,
  events: [],
  currentEvent: null,
  activeTab: "today",
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

// Session & Authentication
const checkStaffAuth = () => {
  const screen = document.getElementById("staffLoginScreen");
  if (!state.token || !state.user || state.user.role !== "staff") {
    screen.style.display = "grid";
  } else {
    screen.style.display = "none";
    document.getElementById("staffDisplayName").textContent = state.user.name || "Staff Member";
    const pos = state.user.staffProfile?.position || "Catering Staff";
    document.getElementById("staffRoleBadge").textContent = pos;

    const initials = (state.user.name || "ST").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
    document.getElementById("staffAvatar").textContent = initials;
    document.getElementById("profileInitials").textContent = initials;
    document.getElementById("profileName").textContent = state.user.name;
    document.getElementById("profileEmail").textContent = state.user.email || state.user.phone;
    document.getElementById("profilePosition").textContent = pos;
    document.getElementById("profileDepartment").textContent = (state.user.staffProfile?.department || "Service").toUpperCase();
  }
};

window.quickLogin = (email, label) => {
  document.getElementById("staffLoginId").value = email;
  document.getElementById("staffLoginPass").value = "staff123";
  document.getElementById("staffLoginForm").dispatchEvent(new Event("submit"));
};

document.getElementById("staffLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorDiv = document.getElementById("staffLoginError");
  errorDiv.style.display = "none";

  const email = document.getElementById("staffLoginId").value.trim();
  const password = document.getElementById("staffLoginPass").value;

  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (data.user.role !== "staff") {
      throw new Error("This account is not registered as catering staff.");
    }

    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("zion_staff_token", data.token);
    localStorage.setItem("zion_staff_user", JSON.stringify(data.user));

    checkStaffAuth();
    loadStaffDashboard();
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.style.display = "block";
  }
});

const logoutStaff = () => {
  if (confirm("End shift and sign out?")) {
    state.token = null;
    state.user = null;
    localStorage.removeItem("zion_staff_token");
    localStorage.removeItem("zion_staff_user");
    checkStaffAuth();
  }
};

document.getElementById("staffLogoutBtn").addEventListener("click", logoutStaff);

// Tabs
const switchStaffTab = (tab) => {
  state.activeTab = tab;
  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".staff-tab-view").forEach((view) => {
    view.style.display = view.id === `tab-${tab}` ? "flex" : "none";
  });

  if (tab === "events") loadStaffEvents();
  if (tab === "today") loadStaffDashboard();
};

// Render Functions
const renderEventCards = (events, containerId) => {
  const container = document.getElementById(containerId);
  if (!events.length) {
    container.innerHTML = `
      <div style="background:#fff; border:1px solid var(--line); border-radius:12px; padding:24px; text-align:center; color:var(--muted); font-size:13px;">
        No events assigned currently. Check back soon or view all schedules.
      </div>
    `;
    return;
  }

  container.innerHTML = events.map((ev) => `
    <div class="event-card" onclick="openEventDetail('${ev.booking_reference || ev.ref}')">
      <div class="event-card-head">
        <div>
          <div class="event-card-title">${ev.package_name || ev.package}</div>
          <div class="event-card-ref">${ev.booking_reference || ev.ref} &bull; ${ev.assigned_role || ev.assignedRole || "Assigned Crew"}</div>
        </div>
        <span class="badge badge-${ev.status}">${ev.status}</span>
      </div>
      <div class="event-card-details">
        <div>📍 ${ev.venue_address || ev.venue}</div>
        <div>👤 Contact: <strong>${ev.customer_first ? `${ev.customer_first} ${ev.customer_last}` : ev.customer?.name}</strong> (${ev.customer_phone || ev.customer?.phone || "No phone"})</div>
      </div>
      <div class="event-card-meta-row">
        <span>📅 ${dateFmt(ev.event_date || ev.date)}, ${String(ev.event_time || ev.time).slice(0, 5)}</span>
        <span>👥 ${ev.guest_count || ev.guests} pax</span>
      </div>
    </div>
  `).join("");
};

const renderTasks = (tasks) => {
  const container = document.getElementById("todayTasksContainer");
  const pendingCountEl = document.getElementById("pendingTasksCount");

  const pending = tasks.filter((t) => t.status !== "completed");
  pendingCountEl.textContent = pending.length;

  if (!tasks.length) {
    container.innerHTML = '<div style="color:var(--muted); font-size:12.5px; padding:12px; text-align:center;">All preparation tasks completed!</div>';
    return;
  }

  container.innerHTML = tasks.map((t) => `
    <div class="task-item ${t.status === "completed" ? "completed" : ""}" onclick="toggleTask(${t.id})">
      <div class="task-checkbox">
        ${t.status === "completed" ? "✓" : ""}
      </div>
      <div class="task-title">${t.title}</div>
      <span class="task-stage">${t.stage}</span>
    </div>
  `).join("");
};

window.toggleTask = async (id) => {
  try {
    await api(`/api/staff/tasks/${id}`, { method: "PATCH" });
    if (state.activeTab === "detail" && state.currentEvent) {
      openEventDetail(state.currentEvent.ref);
    } else {
      loadStaffDashboard();
    }
  } catch (err) {
    alert("Error updating task: " + err.message);
  }
};

window.openEventDetail = async (ref) => {
  try {
    const data = await api(`/api/staff/events/${encodeURIComponent(ref)}`);
    state.currentEvent = data.event;
    const ev = data.event;

    const container = document.getElementById("eventDetailContent");
    const stages = ["preparing", "ready", "delivery", "served"];
    const stageLabels = {
      preparing: "1. Cooking / Prep",
      ready: "2. Food Packed",
      delivery: "3. On The Way",
      served: "4. Service Done",
    };

    container.innerHTML = `
      <div class="sheet-head">
        <span class="badge badge-${ev.status}" style="font-size:12px; margin-bottom:6px;">${ev.status.toUpperCase()}</span>
        <h2>${ev.packageName}</h2>
        <div style="font-size:12px; color:var(--muted);">Reference: <strong>${ev.ref}</strong></div>
      </div>

      <!-- Quick Actions (Call, Map) -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <a href="tel:${ev.customer.phone}" class="btn btn-secondary" style="font-size:12.5px; text-align:center;">
          📞 Call Customer
        </a>
        <a href="https://maps.google.com/?q=${encodeURIComponent(ev.venue)}" target="_blank" class="btn btn-secondary" style="font-size:12.5px; text-align:center;">
          🗺️ Venue Map
        </a>
      </div>

      <!-- Live Event Status Progression -->
      <div class="stepper-box">
        <div class="stepper-title">Update Event Progress (Live Sync)</div>
        <div class="stepper-actions">
          ${stages.map((s) => `
            <button class="btn-step ${ev.status === s ? "current" : ""}" onclick="advanceStatus('${ev.ref}', '${s}')">
              ${stageLabels[s]}
            </button>
          `).join("")}
        </div>
      </div>

      <!-- Schedule & Venue Details -->
      <div class="sheet-section">
        <div class="sheet-section-title">Date, Time & Venue</div>
        <div class="info-box">
          <div><strong>📅 Date:</strong> ${dateFmt(ev.date)} at ${ev.time}</div>
          <div style="margin-top:4px;"><strong>👥 Expected Guests:</strong> ${ev.guests} pax</div>
          <div style="margin-top:4px;"><strong>📍 Address:</strong> ${ev.venue}</div>
          <div style="margin-top:4px;"><strong>👤 Contact Person:</strong> ${ev.customer.name} (${ev.customer.phone || "No phone"})</div>
        </div>
      </div>

      <!-- Package Inclusions -->
      <div class="sheet-section">
        <div class="sheet-section-title">Included Menu & Styling</div>
        <div class="info-box">
          <ul style="padding-left:18px; margin:0;">
            ${ev.inclusions.map((i) => `<li style="margin-bottom:3px;">${i}</li>`).join("")}
          </ul>
        </div>
      </div>

      <!-- Selected Add-ons -->
      ${ev.addons.length ? `
        <div class="sheet-section">
          <div class="sheet-section-title">Special Add-on Deliveries</div>
          <div class="info-box" style="background:#fffcfd; border-color:#fecdd3;">
            <ul style="padding-left:18px; margin:0; color:var(--pink);">
              ${ev.addons.map((a) => `<li style="margin-bottom:3px; font-weight:700;">${a.name} &times; ${a.quantity}</li>`).join("")}
            </ul>
          </div>
        </div>
      ` : ""}

      <!-- Event Task Checklist -->
      <div class="sheet-section">
        <div class="sheet-section-title">Prep & Banquet Checklist</div>
        <div class="checklist-stack">
          ${ev.tasks.map((t) => `
            <div class="task-item ${t.status === "completed" ? "completed" : ""}" onclick="toggleTask(${t.id})">
              <div class="task-checkbox">${t.status === "completed" ? "✓" : ""}</div>
              <div class="task-title">${t.title}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    switchStaffTab("detail");
  } catch (err) {
    alert("Error loading event: " + err.message);
  }
};

window.advanceStatus = async (ref, nextStatus) => {
  try {
    await api(`/api/staff/events/${encodeURIComponent(ref)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    alert(`Event status updated to: ${nextStatus.toUpperCase()}`);
    openEventDetail(ref);
  } catch (err) {
    alert("Error updating status: " + err.message);
  }
};

// Data Loaders
const loadStaffDashboard = async () => {
  try {
    const data = await api("/api/staff/dashboard");
    state.dashboardData = data;

    const events = data.upcomingEvents || [];
    document.getElementById("assignedEventsCount").textContent = events.length;
    renderEventCards(events, "todayEventsContainer");
    renderTasks(data.tasks || []);
  } catch (err) {
    console.error("Dashboard error:", err);
  }
};

const loadStaffEvents = async () => {
  try {
    const data = await api("/api/staff/events?all=true");
    state.events = data.events || [];
    renderEventCards(state.events, "allEventsContainer");
  } catch (err) {
    console.error("Events error:", err);
  }
};

window.filterEvents = (filter) => {
  document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
  event.target.classList.add("active");

  if (filter === "upcoming") {
    const todayStr = new Date().toISOString().slice(0, 10);
    const filtered = state.events.filter((e) => e.date >= todayStr);
    renderEventCards(filtered, "allEventsContainer");
  } else {
    renderEventCards(state.events, "allEventsContainer");
  }
};

// Initial Setup
checkStaffAuth();
if (state.token && state.user && state.user.role === "staff") {
  loadStaffDashboard();
}

