const STORAGE_KEY = "orders";
const platforms = ["Shopee", "Lazada", "TikTok"];
const courierOptions = ["J&T", "Flash", "SPX"];
const defaultApproval = {
  preparedBy: "Adrian 1",
  checkedBy: "Larah"
};

const elements = {};
const uiState = {
  activePlatform: "Shopee"
};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  elements.date.value = getTodayLocalISO();
  renderApp();
});

function cacheElements() {
  elements.date = document.getElementById("date");
  elements.platform = document.getElementById("platform");
  elements.orderId = document.getElementById("orderId");
  elements.preparedBy = document.getElementById("preparedBy");
  elements.checkedBy = document.getElementById("checkedBy");
  elements.formMessage = document.getElementById("formMessage");
  elements.addOrderBtn = document.getElementById("addOrderBtn");
  elements.printSummaryBtn = document.getElementById("printSummaryBtn");
  elements.platformTabs = Array.from(document.querySelectorAll("[data-platform-tab]"));
  elements.platformBoards = Array.from(document.querySelectorAll("[data-platform-board]"));
}

function bindEvents() {
  elements.addOrderBtn.addEventListener("click", addOrder);
  elements.printSummaryBtn.addEventListener("click", printSummary);
  elements.date.addEventListener("change", () => {
    clearMessage();
    renderApp();
  });
  elements.orderId.addEventListener("input", () => {
    elements.orderId.value = elements.orderId.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });
  elements.orderId.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addOrder();
    }
  });
  elements.preparedBy.addEventListener("input", saveApproval);
  elements.checkedBy.addEventListener("input", saveApproval);
  elements.platformTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActivePlatform(tab.dataset.platformTab);
    });
  });

  platforms.forEach((platform) => {
    document.getElementById(platform).addEventListener("change", handleListChange);
    document.getElementById(platform).addEventListener("click", handleListClick);
  });
}

function getTodayLocalISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
}

function getDateKey() {
  return elements.date.value;
}

function readStore() {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    return normalizeStore(JSON.parse(rawValue));
  } catch (error) {
    console.error("Unable to read saved orders:", error);
    showMessage("Saved data was unreadable. The app reset to protect the page.", "error");
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function normalizeStore(rawStore) {
  if (!rawStore || typeof rawStore !== "object" || Array.isArray(rawStore)) {
    return {};
  }

  const normalized = {};

  Object.entries(rawStore).forEach(([dateKey, rawDay]) => {
    if (!rawDay || typeof rawDay !== "object" || Array.isArray(rawDay)) {
      return;
    }

    const platformSource = rawDay.platforms && typeof rawDay.platforms === "object"
      ? rawDay.platforms
      : rawDay;

    normalized[dateKey] = {
      approval: normalizeApproval(rawDay.approval),
      platforms: {}
    };

    platforms.forEach((platform) => {
      const rawOrders = Array.isArray(platformSource[platform]) ? platformSource[platform] : [];
      normalized[dateKey].platforms[platform] = rawOrders.map((order) => normalizeOrder(order));
    });
  });

  return normalized;
}

function normalizeApproval(rawApproval) {
  return {
    preparedBy: typeof rawApproval?.preparedBy === "string" && rawApproval.preparedBy.trim()
      ? rawApproval.preparedBy.trim()
      : defaultApproval.preparedBy,
    checkedBy: typeof rawApproval?.checkedBy === "string" && rawApproval.checkedBy.trim()
      ? rawApproval.checkedBy.trim()
      : defaultApproval.checkedBy
  };
}

function normalizeOrder(rawOrder) {
  const safeId = typeof rawOrder?.id === "string" ? rawOrder.id.trim().toUpperCase() : "";
  const safeCourier = courierOptions.includes(rawOrder?.courier) ? rawOrder.courier : courierOptions[0];

  return {
    uid: typeof rawOrder?.uid === "string" && rawOrder.uid ? rawOrder.uid : buildUid(),
    id: safeId.slice(0, 4),
    courier: safeCourier,
    picture: Boolean(rawOrder?.picture),
    pickup: Boolean(rawOrder?.pickup)
  };
}

function ensureDay(store, dateKey) {
  if (!store[dateKey]) {
    store[dateKey] = {
      approval: { ...defaultApproval },
      platforms: {}
    };
  }

  if (!store[dateKey].approval) {
    store[dateKey].approval = { ...defaultApproval };
  }

  if (!store[dateKey].platforms) {
    store[dateKey].platforms = {};
  }

  platforms.forEach((platform) => {
    if (!Array.isArray(store[dateKey].platforms[platform])) {
      store[dateKey].platforms[platform] = [];
    }
  });

  return store[dateKey];
}

function buildUid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `order-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function isComplete(order) {
  return order.picture && order.pickup;
}

function renderApp() {
  const dateKey = getDateKey();
  const store = readStore();
  const day = ensureDay(store, dateKey);

  elements.preparedBy.value = day.approval.preparedBy;
  elements.checkedBy.value = day.approval.checkedBy;

  platforms.forEach((platform) => {
    renderPlatform(platform, day.platforms[platform]);
  });

  setActivePlatform(uiState.activePlatform);
  writeStore(store);
}

function renderPlatform(platform, orders) {
  const list = document.getElementById(platform);
  list.innerHTML = "";

  if (!orders.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = `No ${platform} orders for this date yet.`;
    list.appendChild(emptyItem);
    updateCounts(platform, orders);
    return;
  }

  orders.forEach((order) => {
    list.appendChild(createOrderItem(platform, order));
  });

  updateCounts(platform, orders);
}

function createOrderItem(platform, order) {
  const item = document.createElement("li");
  item.className = "order-item";
  item.dataset.uid = order.uid;
  item.dataset.platform = platform;

  if (isComplete(order)) {
    item.classList.add("is-complete");
  }

  const courierOptionsHtml = courierOptions
    .map((option) => {
      const selected = order.courier === option ? " selected" : "";
      return `<option value="${option}"${selected}>${option}</option>`;
    })
    .join("");

  item.innerHTML = `
    <div class="order-top">
      <div class="order-id">
        <span class="status-dot" aria-hidden="true"></span>
        <span>${escapeHtml(order.id)}</span>
      </div>
      <button type="button" class="remove-btn" data-action="remove">Remove</button>
    </div>
    <div class="meta-row">
      <label class="field">
        <span>Courier</span>
        <select class="courier-select" data-action="courier">
          ${courierOptionsHtml}
        </select>
      </label>
    </div>
    <div class="order-checks">
      <label class="check-item">
        <input type="checkbox" data-action="picture" ${order.picture ? "checked" : ""}>
        <span>Picture sent</span>
      </label>
      <label class="check-item">
        <input type="checkbox" data-action="pickup" ${order.pickup ? "checked" : ""}>
        <span>Picked up</span>
      </label>
    </div>
    <p class="status-text">${isComplete(order) ? "Completed" : "Pending"}</p>
  `;

  return item;
}

function updateCounts(platform, orders) {
  const total = orders.length;
  const complete = orders.filter(isComplete).length;
  document.getElementById(`count-${platform}`).textContent = `${complete} / ${total} complete`;
}

function setActivePlatform(platform) {
  if (!platforms.includes(platform)) {
    return;
  }

  uiState.activePlatform = platform;

  elements.platformTabs.forEach((tab) => {
    const isActive = tab.dataset.platformTab === platform;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-pressed", String(isActive));
  });

  elements.platformBoards.forEach((board) => {
    board.classList.toggle("is-active", board.dataset.platformBoard === platform);
  });
}

function addOrder() {
  const dateKey = getDateKey();
  const platform = elements.platform.value;
  const orderId = elements.orderId.value.trim().toUpperCase();

  if (!dateKey) {
    showMessage("Select a date before adding an order.", "error");
    elements.date.focus();
    return;
  }

  if (!/^[A-Z0-9]{4}$/.test(orderId)) {
    showMessage("Order ID must be exactly 4 letters or numbers.", "error");
    elements.orderId.focus();
    return;
  }

  const store = readStore();
  const day = ensureDay(store, dateKey);

  const alreadyExists = day.platforms[platform].some((order) => order.id === orderId);
  if (alreadyExists) {
    showMessage(`${platform} order ${orderId} already exists for this date.`, "error");
    elements.orderId.focus();
    return;
  }

  day.platforms[platform].unshift({
    uid: buildUid(),
    id: orderId,
    courier: courierOptions[0],
    picture: false,
    pickup: false
  });

  writeStore(store);
  renderApp();

  elements.orderId.value = "";
  elements.orderId.focus();
  showMessage(`${platform} order ${orderId} added.`, "success");
}

function saveApproval() {
  const dateKey = getDateKey();
  if (!dateKey) {
    return;
  }

  const store = readStore();
  const day = ensureDay(store, dateKey);

  day.approval = {
    preparedBy: elements.preparedBy.value.trim() || defaultApproval.preparedBy,
    checkedBy: elements.checkedBy.value.trim() || defaultApproval.checkedBy
  };

  writeStore(store);
}

function handleListClick(event) {
  const action = event.target.dataset.action;
  if (action !== "remove") {
    return;
  }

  const orderItem = event.target.closest(".order-item");
  if (!orderItem) {
    return;
  }

  const { platform, uid } = orderItem.dataset;
  const store = readStore();
  const day = ensureDay(store, getDateKey());
  day.platforms[platform] = day.platforms[platform].filter((order) => order.uid !== uid);

  writeStore(store);
  renderApp();
  showMessage(`Removed order from ${platform}.`, "success");
}

function handleListChange(event) {
  const action = event.target.dataset.action;
  if (!action) {
    return;
  }

  const orderItem = event.target.closest(".order-item");
  if (!orderItem) {
    return;
  }

  const { platform, uid } = orderItem.dataset;
  const store = readStore();
  const day = ensureDay(store, getDateKey());
  const order = day.platforms[platform].find((entry) => entry.uid === uid);

  if (!order) {
    return;
  }

  if (action === "courier") {
    order.courier = courierOptions.includes(event.target.value) ? event.target.value : courierOptions[0];
  }

  if (action === "picture") {
    order.picture = event.target.checked;
  }

  if (action === "pickup") {
    order.pickup = event.target.checked;
  }

  writeStore(store);
  renderApp();
}

function printSummary() {
  const dateKey = getDateKey();
  const store = readStore();
  const day = store[dateKey];

  if (!dateKey || !day) {
    showMessage("There is no saved data for this date yet.", "error");
    return;
  }

  const summarySections = platforms
    .map((platform) => buildSummaryTable(platform, day.platforms[platform]))
    .filter(Boolean)
    .join("");

  if (!summarySections) {
    showMessage("Add at least one order before printing the summary.", "error");
    return;
  }

  const printWindow = window.open("", "", "width=960,height=720");
  if (!printWindow) {
    showMessage("The summary window was blocked. Please allow pop-ups and try again.", "error");
    return;
  }

  const preparedBy = escapeHtml(day.approval.preparedBy);
  const checkedBy = escapeHtml(day.approval.checkedBy);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Daily Orders Summary</title>
      <style>
        body {
          font-family: "Segoe UI", Arial, sans-serif;
          padding: 24px;
          color: #142033;
        }
        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }
        img {
          max-width: 180px;
          max-height: 72px;
          object-fit: contain;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        th,
        td {
          border: 1px solid #d7deea;
          padding: 10px;
          text-align: left;
        }
        th {
          background: #f4f7fb;
        }
      </style>
    </head>
    <body>
      <div class="summary-header">
        <div>
          <h1>Daily Orders Summary</h1>
          <p><strong>Date:</strong> ${escapeHtml(dateKey)}</p>
          <p><strong>Prepared by:</strong> ${preparedBy}</p>
          <p><strong>Checked by:</strong> ${checkedBy}</p>
        </div>
        <img src="SOLARECO BLACK.png" alt="SolarEco logo">
      </div>
      ${summarySections}
      <script>
        window.onload = () => window.print();
      <\/script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

function buildSummaryTable(platform, orders) {
  if (!orders || !orders.length) {
    return "";
  }

  const rows = orders.map((order) => `
    <tr>
      <td>${escapeHtml(order.id)}</td>
      <td>${escapeHtml(order.courier)}</td>
      <td>${order.picture ? "Yes" : "No"}</td>
      <td>${order.pickup ? "Yes" : "No"}</td>
      <td>${isComplete(order) ? "Completed" : "Pending"}</td>
    </tr>
  `).join("");

  return `
    <section>
      <h2>${escapeHtml(platform)}</h2>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Courier</th>
            <th>Picture Sent</th>
            <th>Picked Up</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    };

    return replacements[char];
  });
}

function showMessage(message, tone = "") {
  elements.formMessage.textContent = message;
  elements.formMessage.className = "form-message";

  if (tone) {
    elements.formMessage.classList.add(tone);
  }
}

function clearMessage() {
  showMessage("");
}
