function updateThemeToggleLabel(isDark){
  if(!elements.themeToggleBtn){return;}
  elements.themeToggleBtn.textContent=isDark?"Light Mode":"Dark Mode";
  elements.themeToggleBtn.setAttribute("aria-pressed",String(isDark));
}

function updateViewTabBadges(summary){
  const counts={orders:summary?.totalOrders||0,requests:summary?.pendingRequests||0,cancelled:summary?.cancelled||0,returned:summary?.returned||0};
  const labels={orders:"active orders",requests:"cancel requests",cancelled:"cancelled orders",returned:"returned orders"};
  Object.entries(elements.viewTabBadges||{}).forEach(([view,badge])=>{
    if(!badge){return;}
    const count=counts[view]||0;
    badge.textContent=String(count);
    badge.setAttribute("aria-label",`${count} ${labels[view]||view}`);
  });
}

async function getSummaryRenderData(){
  const dateKey=getDateKey();
  const store=normalizeStore(uiState.store&&Object.keys(uiState.store).length?uiState.store:await readStore());
  const day=store[dateKey];
  if(!dateKey||!day){showMessage("There is no saved data for this date yet.","error");return null;}
  const daySummary=buildDaySummary(day);
  const sections=[
    ...platforms.map((platform)=>buildSummaryTable(`${platform} Active Orders`,getOrdersForStatus(day.platforms[platform],"active"))),
    ...platforms.map((platform)=>buildSummaryTable(`${platform} Cancelled Orders`,getOrdersForStatus(day.platforms[platform],"cancelled"),{archive:true})),
    ...platforms.map((platform)=>buildSummaryTable(`${platform} Returned Orders`,getOrdersForStatus(day.platforms[platform],"returned"),{archive:true}))
  ].filter(Boolean).join("");
  if(!sections){showMessage("Add at least one order before printing the summary.","error");return null;}
  return{dateKey,preparedBy:day.approval.preparedBy,checkedBy:day.approval.checkedBy,daySummary,summarySections:sections};
}

function buildSummaryTable(title,orders,options={}){
  if(!orders||!orders.length){return "";}
  const totals=buildOrderCollectionSummary(orders);
  const rows=orders.map((order)=>`<tr><td>${escapeHtml(order.id)}</td><td>${escapeHtml(buildSummaryItemsLabel(order.items))}</td><td>${formatMoney(getLineItemsTarget(order.items))}</td><td>${order.totalSales===null?"-":formatMoney(order.totalSales)}</td><td>${escapeHtml(order.courier)}</td><td>${order.picture?"Yes":"No"}</td><td>${order.pickup?"Yes":"No"}</td><td>${getOrderLifecycleLabel(order)}</td><td>${escapeHtml(buildSummaryReasonLabel(order))}</td><td>${getSalesOutcome(order).label}</td></tr>`).join("");
  return `<section><h2>${escapeHtml(title)}</h2><table><thead><tr><th>Order ID</th><th>Items</th><th>SRP Total</th><th>Total Sales</th><th>Courier</th><th>Picture Sent</th><th>Picked Up</th><th>Status</th><th>Reason</th><th>Result</th></tr></thead><tbody>${rows}<tr class="table-total"><td colspan="2">${options.archive?"Record Totals":"Totals"}</td><td>${formatMoney(totals.srpTotal)}</td><td>${formatMoney(totals.salesTotal)}</td><td>${totals.courierSummary}</td><td>${totals.pictureSent}</td><td>${totals.pickedUp}</td><td>${totals.completed} complete / ${totals.cancelled} cancelled / ${totals.returned} returned</td><td>-</td><td>${formatSignedMoney(totals.totalProfit)} profit / ${totals.notPickedUp} not picked up</td></tr></tbody></table></section>`;
}

function buildDaySummary(day){
  const allOrders=platforms.flatMap((platform)=>day.platforms[platform]||[]);
  const activeOrders=allOrders.filter((order)=>normalizeOrderStatus(order.status)==="active");
  const cancelledOrders=allOrders.filter((order)=>normalizeOrderStatus(order.status)==="cancelled");
  const returnedOrders=allOrders.filter((order)=>normalizeOrderStatus(order.status)==="returned");
  const totals=buildOrderCollectionSummary(activeOrders);
  return{...totals,cancelled:cancelledOrders.length,returned:returnedOrders.length,cancelledSummary:buildOrderCollectionSummary(cancelledOrders),returnedSummary:buildOrderCollectionSummary(returnedOrders),courierTotals:Object.entries(totals.courierCounts).sort((left,right)=>left[0].localeCompare(right[0]))};
}

function buildSummaryOverviewHtml(summary){
  return `<section class="summary-overview"><div class="summary-group"><p class="summary-group-title">Today's Orders</p><div class="summary-grid"><div class="summary-card"><p class="summary-card-label">Active Orders</p><p class="summary-card-value">${summary.totalOrders}</p></div><div class="summary-card"><p class="summary-card-label">SRP Total</p><p class="summary-card-value">${formatMoney(summary.srpTotal)}</p></div><div class="summary-card"><p class="summary-card-label">Total Sales</p><p class="summary-card-value">${formatMoney(summary.salesTotal)}</p></div><div class="summary-card"><p class="summary-card-label">Active Profit</p><p class="summary-card-value">${formatSignedMoney(summary.totalProfit)}</p></div></div></div><div class="summary-group"><p class="summary-group-title">Cancelled / Returned Records</p><div class="summary-grid secondary"><div class="summary-card secondary"><p class="summary-card-label">Cancelled Orders</p><p class="summary-card-value">${summary.cancelled}</p></div><div class="summary-card secondary"><p class="summary-card-label">Returned Orders</p><p class="summary-card-value">${summary.returned}</p></div><div class="summary-card secondary"><p class="summary-card-label">Cancelled Sales</p><p class="summary-card-value">${formatMoney(summary.cancelledSummary.salesTotal)}</p></div><div class="summary-card secondary"><p class="summary-card-label">Returned Sales</p><p class="summary-card-value">${formatMoney(summary.returnedSummary.salesTotal)}</p></div></div></div></section>`;
}
