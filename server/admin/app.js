const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const statuses = ["confirmed", "preparing", "ready", "delivery", "served", "cancelled"];
const API_BASE =
  window.location.protocol === "file:" ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port !== "4000")
    ? "http://localhost:4000"
    : "";

const els = {
  bookingCount: document.querySelector("#bookingCount"),
  revenueTotal: document.querySelector("#revenueTotal"),
  customerCount: document.querySelector("#customerCount"),
  messageCount: document.querySelector("#messageCount"),
  bookingRows: document.querySelector("#bookingRows"),
  customerRows: document.querySelector("#customerRows"),
  messageRows: document.querySelector("#messageRows"),
  apiStatus: document.querySelector("#apiStatus"),
  refreshBtn: document.querySelector("#refreshBtn"),
};

const api = async (path, options) => {
  const response = await fetch(`${API_BASE}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : { error: await response.text() };
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

const dateLabel = (value) => {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

const renderBookings = (bookings) => {
  els.bookingRows.innerHTML = "";

  if (!bookings.length) {
    els.bookingRows.innerHTML = '<tr><td colspan="7" class="empty">No bookings yet.</td></tr>';
    return;
  }

  for (const booking of bookings) {
    const row = document.createElement("tr");
    const options = statuses.map((status) => `<option value="${status}" ${booking.status === status ? "selected" : ""}>${status}</option>`).join("");
    row.innerHTML = `
      <td><strong>${booking.ref}</strong><div class="muted">${booking.method || "No method"}</div></td>
      <td>${booking.customer?.name || "Guest"}<div class="muted">${booking.customer?.phone || booking.customer?.email || "No contact"}</div></td>
      <td>${booking.pkg}<div class="muted">${booking.guests} pax</div></td>
      <td>${booking.date}<div class="muted">${booking.time}</div></td>
      <td>${peso.format(Number(booking.total || 0))}</td>
      <td><span class="status ${booking.status}">${booking.status}</span></td>
      <td class="actions">
        <select data-action="status" data-ref="${booking.ref}">${options}</select>
        <button class="danger" data-action="delete" data-ref="${booking.ref}" type="button">Delete</button>
      </td>
    `;
    els.bookingRows.appendChild(row);
  }
};

const renderUsers = (users) => {
  els.customerRows.innerHTML = users.length ? "" : '<div class="empty">No customers yet.</div>';
  for (const user of users) {
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div>
        <strong>${user.name || "Unnamed customer"}</strong>
        <div class="muted">${user.email || "No email"} | ${user.phone || "No phone"}</div>
      </div>
      <div class="muted">${dateLabel(user.createdAt)}</div>
    `;
    els.customerRows.appendChild(item);
  }
};

const renderMessages = (contacts) => {
  els.messageRows.innerHTML = contacts.length ? "" : '<div class="empty">No messages yet.</div>';
  for (const message of contacts) {
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div>
        <strong>${message.name || "Unknown"}</strong>
        <div>${message.message || ""}</div>
        <div class="muted">${message.email || ""} ${message.phone || ""}</div>
      </div>
      <div class="muted">${dateLabel(message.createdAt)}</div>
    `;
    els.messageRows.appendChild(item);
  }
};

const loadDashboard = async () => {
  els.apiStatus.textContent = "Loading";
  try {
    const [{ bookings }, { users }, { contacts }] = await Promise.all([
      api("/api/bookings"),
      api("/api/users"),
      api("/api/contact"),
    ]);

    els.bookingCount.textContent = bookings.length;
    els.revenueTotal.textContent = peso.format(bookings.reduce((sum, booking) => sum + Number(booking.total || 0), 0));
    els.customerCount.textContent = users.length;
    els.messageCount.textContent = contacts.length;
    renderBookings(bookings);
    renderUsers(users);
    renderMessages(contacts);
    els.apiStatus.textContent = "Connected";
  } catch (error) {
    els.apiStatus.textContent = error.message;
  }
};

els.refreshBtn.addEventListener("click", loadDashboard);

els.bookingRows.addEventListener("change", async (event) => {
  if (event.target.dataset.action !== "status") return;
  try {
    await api(`/api/bookings/${encodeURIComponent(event.target.dataset.ref)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: event.target.value }),
    });
    await loadDashboard();
  } catch (error) {
    els.apiStatus.textContent = error.message;
    await loadDashboard();
  }
});

els.bookingRows.addEventListener("click", async (event) => {
  if (event.target.dataset.action !== "delete") return;
  if (!confirm(`Delete booking ${event.target.dataset.ref}?`)) return;
  try {
    await api(`/api/bookings/${encodeURIComponent(event.target.dataset.ref)}`, { method: "DELETE" });
    await loadDashboard();
  } catch (error) {
    els.apiStatus.textContent = error.message;
  }
});

void loadDashboard();
