const platforms = ["Shopee", "Lazada", "TikTok"];

// 📅 Get date
function getDateKey() {
  return document.getElementById("date").value;
}

// 💾 Get data
function getData() {
  return JSON.parse(localStorage.getItem("orders")) || {};
}

// 💾 Save data
function saveData(data) {
  localStorage.setItem("orders", JSON.stringify(data));
}

// 📊 Counts
function updateCounts(platform) {
  const list = document.getElementById(platform);
  const items = list.querySelectorAll("li");

  let total = items.length;
  let done = 0;

  items.forEach(item => {
    if (item.classList.contains("done")) done++;
  });

  document.getElementById(`count-${platform}`).textContent = `${done} / ${total}`;
}

// 🔄 Render
function renderOrders() {
  const data = getData();
  const dateKey = getDateKey();

  // ✅ LOAD APPROVAL (NEW)
  const approval = data[dateKey]?.approval;

  if (approval) {
    document.getElementById("preparedBy").value = approval.preparedBy || "Adrian 1";
    document.getElementById("checkedBy").value = approval.checkedBy || "Larah";
  } else {
    document.getElementById("preparedBy").value = "Adrian 1";
    document.getElementById("checkedBy").value = "Larah";
  }

  platforms.forEach(platform => {
    const list = document.getElementById(platform);
    list.innerHTML = "";

    const orders = data[dateKey]?.[platform] || [];

    orders.forEach((order, index) => {
      createOrderElement(platform, order, index);
    });

    updateCounts(platform);
  });
}

// ➕ Add
function addOrder() {
  const platform = document.getElementById("platform").value;
  const orderId = document.getElementById("orderId").value.trim();
  const dateKey = getDateKey();

  if (!dateKey) return alert("Select date first");
  if (!orderId) return alert("Enter Order ID");

  const data = getData();

  if (!data[dateKey]) data[dateKey] = {};
  if (!data[dateKey][platform]) data[dateKey][platform] = [];

  data[dateKey][platform].push({
    id: orderId,
    courier: "J&T",
    picture: false,
    pickup: false,
    done: false
  });

  saveData(data);
  renderOrders();

  document.getElementById("orderId").value = "";
}

// 🧱 Create item
function createOrderElement(platform, order, index) {
  const list = document.getElementById(platform);
  const li = document.createElement("li");
  const dateKey = getDateKey();

  if (order.done) li.classList.add("done");

  // ❌ remove
  const removeBtn = document.createElement("span");
  removeBtn.textContent = "✖";
  removeBtn.className = "remove-btn";

  removeBtn.onclick = (e) => {
    e.stopPropagation();
    const data = getData();
    data[dateKey][platform].splice(index, 1);
    saveData(data);
    li.remove();
    updateCounts(platform);
  };

  const content = document.createElement("div");
  content.className = "order-content";

  // Order ID
  const orderText = document.createElement("div");
  orderText.textContent = order.id;
  orderText.className = "order-id";

  orderText.onclick = () => {
    const data = getData();
    data[dateKey][platform][index].done = !data[dateKey][platform][index].done;
    saveData(data);

    li.classList.toggle("done");
    updateCounts(platform);
  };

  // 🚚 Courier
  const courier = document.createElement("select");
  courier.className = "courier";

  ["J&T", "Flash", "SPX"].forEach(c => {
    const option = document.createElement("option");
    option.value = c;
    option.textContent = c;
    if (order.courier === c) option.selected = true;
    courier.appendChild(option);
  });

  courier.onclick = (e) => e.stopPropagation();

  courier.onchange = () => {
    const data = getData();
    data[dateKey][platform][index].courier = courier.value;
    saveData(data);
  };

  // 📸 Picture
  const pic = document.createElement("input");
  pic.type = "checkbox";
  pic.checked = order.picture;
  pic.onclick = (e) => e.stopPropagation();

  // 📦 Pickup
  const pickup = document.createElement("input");
  pickup.type = "checkbox";
  pickup.checked = order.pickup;
  pickup.onclick = (e) => e.stopPropagation();

  function updateStatus() {
    const data = getData();
    const item = data[dateKey][platform][index];

    item.picture = pic.checked;
    item.pickup = pickup.checked;
    item.done = item.picture && item.pickup;

    saveData(data);

    li.classList.toggle("done", item.done);
    updateCounts(platform);
  }

  pic.onchange = updateStatus;
  pickup.onchange = updateStatus;

  // Labels
  const picLabel = document.createElement("label");
  picLabel.className = "check-item";
  picLabel.appendChild(pic);
  picLabel.append(" Picture Sent");

  const pickupLabel = document.createElement("label");
  pickupLabel.className = "check-item";
  pickupLabel.appendChild(pickup);
  pickupLabel.append(" Picked Up");

  content.append(orderText, courier, picLabel, pickupLabel);
  li.append(removeBtn, content);
  list.appendChild(li);
}

// ✅ SAVE APPROVAL PER DATE
function saveApproval() {
  const dateKey = getDateKey();
  const data = getData();

  if (!data[dateKey]) data[dateKey] = {};

  data[dateKey].approval = {
    preparedBy: document.getElementById("preparedBy").value,
    checkedBy: document.getElementById("checkedBy").value
  };

  saveData(data);
}

// 🎯 EVENTS
document.getElementById("preparedBy").addEventListener("change", saveApproval);
document.getElementById("checkedBy").addEventListener("change", saveApproval);
document.getElementById("date").addEventListener("change", renderOrders);

// 🚀 INIT
window.onload = () => {
  document.getElementById("date").value = new Date().toISOString().split("T")[0];
  renderOrders();
};

// 🖨 SUMMARY
function printSummary() {
  const data = getData();
  const dateKey = getDateKey();

  if (!dateKey || !data[dateKey]) return alert("No data");

  const preparedBy = document.getElementById("preparedBy").value;
  const checkedBy = document.getElementById("checkedBy").value;

  const dayData = data[dateKey];

  let html = `
  <html>
  <body style="font-family:Arial;padding:20px">

  <div style="display:flex;justify-content:space-between;align-items:center;">
    <div>
      <h1>📦 Daily Report</h1>
      <p>Date: ${dateKey}</p>
      <p>
        <strong>Prepared by:</strong> ${preparedBy}<br>
        <strong>Checked by:</strong> ${checkedBy}
      </p>
    </div>
    <img src="SOLARECO BLACK.png" style="height:60px;">
  </div>
  `;

  platforms.forEach(p => {
    const orders = dayData[p] || [];
    if (!orders.length) return;

    html += `<h2>${p}</h2><table border="1" cellpadding="8" cellspacing="0" style="width:100%;">
    <tr><th>ID</th><th>Courier</th><th>Picture</th><th>Pickup</th><th>Status</th></tr>`;

    orders.forEach(o => {
      html += `<tr>
        <td>${o.id}</td>
        <td>${o.courier}</td>
        <td>${o.picture ? "✔" : "✖"}</td>
        <td>${o.pickup ? "✔" : "✖"}</td>
        <td>${o.done ? "Completed" : "Pending"}</td>
      </tr>`;
    });

    html += `</table>`;
  });

  html += `<script>window.onload=()=>window.print()<\/script></body></html>`;

  const win = window.open("", "", "width=900,height=700");
  win.document.write(html);
  win.document.close();
}
