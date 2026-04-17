const STORAGE_KEY="orders";
const platforms=["Shopee","Lazada","TikTok"];
const courierOptions=["J&T","Flash","SPX"];
const defaultApproval={preparedBy:"Adrian 1",checkedBy:"Larah"};
const elements={};
const uiState={activePlatform:"Shopee",drafts:{},expandedLineId:null};

document.addEventListener("DOMContentLoaded",()=>{
  cacheElements();
  bindEvents();
  elements.date.value=getTodayLocalISO();
  ensureDraftState();
  renderApp();
});

function cacheElements(){
  elements.date=document.getElementById("date");
  elements.skuOptions=document.getElementById("skuOptions");
  elements.preparedBy=document.getElementById("preparedBy");
  elements.checkedBy=document.getElementById("checkedBy");
  elements.topMessage=document.getElementById("topMessage");
  elements.printSummaryBtn=document.getElementById("printSummaryBtn");
  elements.platformTabs=Array.from(document.querySelectorAll("[data-platform-tab]"));
  elements.platformBoards=Array.from(document.querySelectorAll("[data-platform-board]"));
}

function bindEvents(){
  elements.printSummaryBtn.addEventListener("click",printSummary);
  elements.date.addEventListener("change",()=>{
    resetAllDrafts();
    clearMessage();
    renderApp();
  });
  elements.preparedBy.addEventListener("input",saveApproval);
  elements.checkedBy.addEventListener("input",saveApproval);
  elements.platformTabs.forEach((tab)=>tab.addEventListener("click",()=>setActivePlatform(tab.dataset.platformTab)));
  platforms.forEach((platform)=>{
    const draftSection=document.querySelector(`[data-draft-platform="${platform}"]`);
    const list=document.getElementById(platform);
    if(!draftSection||!list){return;}
    draftSection.addEventListener("click",handleDraftSectionClick);
    draftSection.addEventListener("input",handleDraftSectionInput);
    draftSection.addEventListener("change",handleDraftSectionChange);
    draftSection.addEventListener("keydown",(event)=>{
      if(event.key==="Enter"&&event.target.id===`orderId-${platform}`){
        event.preventDefault();
        addOrder(platform);
      }
    });
    list.addEventListener("change",handleSavedOrderChange);
    list.addEventListener("click",handleSavedOrderClick);
  });
}

function getTodayLocalISO(){
  const now=new Date();
  const local=new Date(now.getTime()-now.getTimezoneOffset()*60000);
  return local.toISOString().split("T")[0];
}

function getDateKey(){return elements.date.value;}
function sanitizeSku(value){return typeof value==="string"?value.toUpperCase().replace(/[^A-Z0-9]/g,""):"";}
function sanitizeOrderId(value){return typeof value==="string"?value.trim():"";}

function readStore(){
  try{
    const rawValue=localStorage.getItem(STORAGE_KEY);
    return rawValue?normalizeStore(JSON.parse(rawValue)):{};
  }catch(error){
    console.error("Unable to read saved orders:",error);
    showMessage("Saved data was unreadable. The app reset to protect the page.","error");
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

function writeStore(store){localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}

function readCatalog(){
  return normalizeCatalog(Array.isArray(window.SKU_CATALOG)?window.SKU_CATALOG:[]);
}

function writeCatalog(catalog){}

function normalizeStore(rawStore){
  if(!rawStore||typeof rawStore!=="object"||Array.isArray(rawStore)){return {};}
  const normalized={};
  Object.entries(rawStore).forEach(([dateKey,rawDay])=>{
    if(!rawDay||typeof rawDay!=="object"||Array.isArray(rawDay)){return;}
    const platformSource=rawDay.platforms&&typeof rawDay.platforms==="object"?rawDay.platforms:rawDay;
    normalized[dateKey]={approval:normalizeApproval(rawDay.approval),platforms:{}};
    platforms.forEach((platform)=>{
      const rawOrders=Array.isArray(platformSource[platform])?platformSource[platform]:[];
      normalized[dateKey].platforms[platform]=rawOrders.map((order)=>normalizeOrder(order));
    });
  });
  return normalized;
}

function normalizeApproval(rawApproval){
  return{
    preparedBy:typeof rawApproval?.preparedBy==="string"&&rawApproval.preparedBy.trim()?rawApproval.preparedBy.trim():defaultApproval.preparedBy,
    checkedBy:typeof rawApproval?.checkedBy==="string"&&rawApproval.checkedBy.trim()?rawApproval.checkedBy.trim():defaultApproval.checkedBy
  };
}

function normalizeOrder(rawOrder){
  const safeId=sanitizeOrderId(rawOrder?.id);
  const safeCourier=courierOptions.includes(rawOrder?.courier)?rawOrder.courier:courierOptions[0];
  const items=Array.isArray(rawOrder?.items)?rawOrder.items.map((item)=>normalizeLineItem(item)).filter(isMeaningfulLineItem):buildLegacyItems(rawOrder);
  return{uid:typeof rawOrder?.uid==="string"&&rawOrder.uid?rawOrder.uid:buildUid("order"),id:safeId,items,totalSales:normalizeMoney(rawOrder?.totalSales),courier:safeCourier,picture:Boolean(rawOrder?.picture),pickup:Boolean(rawOrder?.pickup)};
}

function buildLegacyItems(rawOrder){
  const legacySku=typeof rawOrder?.sku==="string"?sanitizeSku(rawOrder.sku.trim()):"";
  const legacySrp=normalizeMoney(rawOrder?.srp);
  const legacyQty=normalizeQuantity(rawOrder?.qty)??1;
  if(!legacySku&&legacySrp===null){return [];}
  return[{uid:buildUid("line"),sku:legacySku,item:"",srp:legacySrp,qty:legacyQty}];
}

function normalizeLineItem(rawItem){
  const safeSku=typeof rawItem?.sku==="string"?sanitizeSku(rawItem.sku.trim()):"";
  const safeItem=typeof rawItem?.item==="string"?rawItem.item.trim():"";
  return{uid:typeof rawItem?.uid==="string"&&rawItem.uid?rawItem.uid:buildUid("line"),sku:safeSku,item:safeItem,srp:normalizeMoney(rawItem?.srp),qty:normalizeQuantity(rawItem?.qty)??1};
}

function normalizeCatalog(rawCatalog){
  if(!Array.isArray(rawCatalog)){return [];}
  const deduped=new Map();
  rawCatalog.forEach((entry)=>{
    const sku=typeof entry?.sku==="string"?sanitizeSku(entry.sku.trim()):"";
    const item=typeof entry?.item==="string"?entry.item.trim():"";
    const srp=normalizeMoney(entry?.srp);
    if(!sku||srp===null){return;}
    deduped.set(sku,{sku,item,srp});
  });
  return Array.from(deduped.values()).sort((left,right)=>left.sku.localeCompare(right.sku));
}

function ensureDay(store,dateKey){
  if(!store[dateKey]){store[dateKey]={approval:{...defaultApproval},platforms:{}};}
  if(!store[dateKey].approval){store[dateKey].approval={...defaultApproval};}
  if(!store[dateKey].platforms){store[dateKey].platforms={};}
  platforms.forEach((platform)=>{if(!Array.isArray(store[dateKey].platforms[platform])){store[dateKey].platforms[platform]=[];}});
  return store[dateKey];
}

function buildUid(prefix){
  if(window.crypto&&typeof window.crypto.randomUUID==="function"){return `${prefix}-${window.crypto.randomUUID()}`;}
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2,10)}`;
}

function createLineItem(overrides={}){
  return{uid:overrides.uid||buildUid("line"),sku:overrides.sku||"",item:overrides.item||"",srp:overrides.srp??null,qty:overrides.qty??1};
}

function isMeaningfulLineItem(item){return Boolean(item.sku||item.srp!==null);}

function ensureDraftState(){
  platforms.forEach((platform)=>{
    if(!uiState.drafts[platform]){
      uiState.drafts[platform]=buildEmptyDraft();
    }
  });
}

function buildEmptyDraft(){
  return{orderId:"",totalSales:"",items:[],message:"",messageTone:""};
}

function getDraft(platform){
  ensureDraftState();
  return uiState.drafts[platform];
}

function resetDraft(platform){
  uiState.drafts[platform]=buildEmptyDraft();
}

function resetAllDrafts(){
  platforms.forEach((platform)=>resetDraft(platform));
}

function getDraftElements(platform){
  return{
    orderId:document.getElementById(`orderId-${platform}`),
    orderSales:document.getElementById(`orderSales-${platform}`),
    orderTarget:document.getElementById(`orderTarget-${platform}`),
    orderItemRows:document.getElementById(`orderItemRows-${platform}`),
    addOrderBtn:document.getElementById(`addOrderBtn-${platform}`),
    formMessage:document.getElementById(`formMessage-${platform}`)
  };
}

function renderApp(){
  const dateKey=getDateKey();
  const store=readStore();
  const catalog=readCatalog();
  const catalogMap=buildCatalogMap(catalog);
  syncOrdersWithCatalog(store,catalogMap);
  ensureDraftState();
  renderSkuDatalist(catalog);
  syncDraftsWithCatalog(catalogMap);
  if(!dateKey){
    platforms.forEach((platform)=>{
      renderDraftSection(platform,catalog);
      renderPlatform(platform,[],catalog);
    });
    return;
  }
  const day=ensureDay(store,dateKey);
  elements.preparedBy.value=day.approval.preparedBy;
  elements.checkedBy.value=day.approval.checkedBy;
  platforms.forEach((platform)=>{
    renderDraftSection(platform,catalog);
    renderPlatform(platform,day.platforms[platform],catalog);
  });
  setActivePlatform(uiState.activePlatform);
  writeStore(store);
  writeCatalog(catalog);
}

function renderSkuDatalist(catalog){
  elements.skuOptions.innerHTML=catalog.map((entry)=>`<option value="${escapeHtml(entry.sku)}" label="${escapeHtml(entry.item)}"></option>`).join("");
}

function renderDraftSection(platform,catalog){
  const draft=getDraft(platform);
  const draftElements=getDraftElements(platform);
  draftElements.orderId.value=draft.orderId;
  draftElements.orderSales.value=draft.totalSales;
  draftElements.orderItemRows.innerHTML="";
  if(!draft.items.length){
    const emptyState=document.createElement("div");
    emptyState.className="line-item-empty";
    emptyState.textContent="Click Add SKU Line to start this order.";
    draftElements.orderItemRows.appendChild(emptyState);
  }else{
    draft.items.forEach((item)=>draftElements.orderItemRows.appendChild(createLineItemRow(item,catalog,"draft")));
  }
  draftElements.orderTarget.value=formatMoney(getLineItemsTarget(draft.items));
  updateDraftButtonState(platform);
  draftElements.formMessage.textContent=draft.message;
  draftElements.formMessage.className="form-message";
  if(draft.messageTone){draftElements.formMessage.classList.add(draft.messageTone);}
}

function renderPlatform(platform,orders,catalog){
  const list=document.getElementById(platform);
  list.innerHTML="";
  const draft=getDraft(platform);
  const ordered=[...orders].sort((left,right)=>left.id.localeCompare(right.id,undefined,{numeric:true,sensitivity:"base"}));
  if(hasDraftContent(draft)){
    list.appendChild(createDraftOrderCard(platform,draft));
  }
  if(!ordered.length&&!hasDraftContent(draft)){
    const emptyItem=document.createElement("li");
    emptyItem.className="empty-state";
    emptyItem.textContent=`No ${platform} orders for this date yet.`;
    list.appendChild(emptyItem);
    updateCounts(platform,orders);
    return;
  }
  ordered.forEach((order)=>list.appendChild(createOrderCard(platform,order,catalog)));
  updateCounts(platform,orders);
}

function refreshPlatformList(platform){
  const catalog=readCatalog();
  const store=readStore();
  const dateKey=getDateKey();
  const orders=dateKey?ensureDay(store,dateKey).platforms[platform]:[];
  renderPlatform(platform,orders,catalog);
}

function updateDraftButtonState(platform){
  const draftElements=getDraftElements(platform);
  if(!draftElements.addOrderBtn){return;}
  draftElements.addOrderBtn.textContent=hasDraftContent(getDraft(platform))?`Save ${platform} Order`:`Add ${platform} Order`;
}

function clearDraftFormDom(platform){
  const draftElements=getDraftElements(platform);
  if(draftElements.orderId){draftElements.orderId.value="";}
  if(draftElements.orderSales){draftElements.orderSales.value="";}
  if(draftElements.orderTarget){draftElements.orderTarget.value=formatMoney(null);}
  if(draftElements.orderItemRows){
    draftElements.orderItemRows.innerHTML="";
    const emptyState=document.createElement("div");
    emptyState.className="line-item-empty";
    emptyState.textContent="Click Add SKU Line to start this order.";
    draftElements.orderItemRows.appendChild(emptyState);
  }
  if(draftElements.formMessage){
    draftElements.formMessage.textContent="";
    draftElements.formMessage.className="form-message";
  }
  updateDraftButtonState(platform);
}

function createDraftOrderCard(platform,draft){
  const item=document.createElement("li");
  item.className="order-item draft-order-item";
  const meaningfulItems=draft.items.filter((line)=>sanitizeSku(line.sku||""));
  const itemsHtml=meaningfulItems.length?meaningfulItems.map((line,index)=>`
    <div class="draft-list-line">
      <span class="line-number">${index+1}</span>
      <span class="line-preview-name">${escapeHtml(line.item||line.sku||"Unknown item")}</span>
      <span class="line-preview-qty">Qty ${line.qty}</span>
    </div>
  `).join(""):'<div class="line-item-empty">No SKU selected yet.</div>';
  item.innerHTML=`
    <div class="order-top">
      <div class="order-id">
        <span class="status-dot" aria-hidden="true"></span>
        <span>${escapeHtml(draft.orderId||`${platform} draft`)}</span>
      </div>
      <div class="order-top-actions">
        <span class="item-count-indicator">${meaningfulItems.length} item${meaningfulItems.length===1?"":"s"}</span>
        <span class="draft-pill">Draft</span>
      </div>
    </div>
    <div class="saved-line-items">${itemsHtml}</div>
    <div class="meta-row">
      <label class="field readonly-field">
        <span>SRP Total</span>
        <input type="text" value="${formatMoney(getLineItemsTarget(draft.items))}" readonly>
      </label>
      <label class="field readonly-field">
        <span>Total Sales</span>
        <input type="text" value="${formatMoney(normalizeMoney(draft.totalSales))}" readonly>
      </label>
    </div>
  `;
  return item;
}

function createOrderCard(platform,order,catalog){
  const item=document.createElement("li");
  item.className="order-item";
  item.dataset.uid=order.uid;
  item.dataset.platform=platform;
  if(isComplete(order)){item.classList.add("is-complete");}
  const salesOutcome=getSalesOutcome(order);
  const courierOptionsHtml=courierOptions.map((option)=>{
    const selected=order.courier===option?" selected":"";
    return `<option value="${option}"${selected}>${option}</option>`;
  }).join("");
  item.innerHTML=`
    <div class="order-top">
      <div class="order-id">
        <span class="status-dot" aria-hidden="true"></span>
        <span>${escapeHtml(order.id)}</span>
      </div>
      <div class="order-top-actions">
        <span class="item-count-indicator">${order.items.length} item${order.items.length===1?"":"s"}</span>
        <button type="button" class="remove-btn" data-action="remove-order">Remove</button>
      </div>
    </div>
    <div class="saved-line-items">${buildSavedLineItemsHtml(order.items,catalog)}</div>
    <div class="button-row compact-row">
      <button type="button" class="secondary-btn compact-btn" data-action="add-line">Add SKU Line</button>
    </div>
    <div class="meta-row">
      <label class="field readonly-field">
        <span>SRP Total</span>
        <input type="text" value="${formatMoney(getLineItemsTarget(order.items))}" readonly>
      </label>
      <label class="field">
        <span>Total Sales</span>
        <input type="number" min="0" step="0.01" class="sales-input" data-action="totalSales" value="${order.totalSales===null?"":order.totalSales.toFixed(2)}" placeholder="0.00">
      </label>
      <label class="field">
        <span>Courier</span>
        <select class="courier-select" data-action="courier">${courierOptionsHtml}</select>
      </label>
    </div>
    <div class="order-checks">
      <label class="check-item"><input type="checkbox" data-action="picture" ${order.picture?"checked":""}><span>Picture sent</span></label>
      <label class="check-item"><input type="checkbox" data-action="pickup" ${order.pickup?"checked":""}><span>Picked up</span></label>
    </div>
    <div class="status-row">
      <p class="status-text">${isComplete(order)?"Completed":"Pending"}</p>
      <span class="result-badge ${salesOutcome.tone}">${salesOutcome.label}</span>
    </div>
  `;
  return item;
}

function buildSavedLineItemsHtml(items,catalog){
  if(!items.length){return '<div class="line-item-empty">No SKU lines yet for this order.</div>';}
  return items.map((item,index)=>buildSavedLineBlockHtml(item,catalog,index)).join("");
}

function buildSavedLineBlockHtml(item,catalog,index){
  const isExpanded=uiState.expandedLineId===item.uid;
  return `
    <div class="saved-line-block" data-line-id="${item.uid}">
      <div class="saved-line-preview-row">
        <span class="line-number">${index+1}</span>
        <span class="line-preview-name">${escapeHtml(item.item||item.sku||"Unknown item")}</span>
        <span class="line-preview-qty">Qty ${item.qty}</span>
        <button type="button" class="view-btn" data-action="toggle-line-details">${isExpanded?"Hide":"View"}</button>
      </div>
      <div class="saved-line-details ${isExpanded?"is-open":""}">
        ${buildLineItemRowHtml(item,catalog,"saved")}
      </div>
    </div>
  `;
}

function createLineItemRow(item,catalog,mode){
  const wrapper=document.createElement("div");
  wrapper.innerHTML=buildLineItemRowHtml(item,catalog,mode);
  return wrapper.firstElementChild;
}

function buildLineItemRowHtml(item,catalog,mode){
  const lineTotal=getLineItemTotal(item);
  const removeAction=mode==="draft"?"remove-draft-line":"remove-line";
  const skuAction=mode==="draft"?"draft-line-sku":"line-sku";
  const qtyAction=mode==="draft"?"draft-line-qty":"line-qty";
  if(mode==="draft"){
    return `
      <div class="line-item-row draft-line-row" data-line-id="${item.uid}">
        <label class="field draft-sku-field">
          <span>SKU</span>
          <input type="text" list="skuOptions" value="${escapeHtml(item.sku)}" data-action="${skuAction}" placeholder="Search SKU">
        </label>
        <label class="field draft-qty-field">
          <span>Qty</span>
          <input type="number" min="1" step="1" value="${item.qty}" data-action="${qtyAction}">
        </label>
        <button type="button" class="line-item-remove" data-action="${removeAction}">Remove</button>
        <div class="draft-line-caption">
          <span class="draft-line-item" data-role="item-name">${escapeHtml(item.item||"Select a SKU")}</span>
          <span class="draft-line-sep">|</span>
          <span data-role="unit-srp">SRP ${formatMoney(item.srp)}</span>
          <span class="draft-line-sep">|</span>
          <span data-role="line-total">Total ${formatMoney(lineTotal)}</span>
        </div>
      </div>
    `;
  }
  return `
    <div class="line-item-row" data-line-id="${item.uid}">
      <label class="field">
        <span>SKU</span>
        <input type="text" list="skuOptions" value="${escapeHtml(item.sku)}" data-action="${skuAction}" placeholder="Search SKU">
      </label>
      <label class="field readonly-field">
        <span>Item</span>
        <input type="text" value="${escapeHtml(item.item||"")}" data-role="item-name" readonly>
      </label>
      <label class="field readonly-field">
        <span>Unit SRP</span>
        <input type="text" value="${formatMoney(item.srp)}" data-role="unit-srp" readonly>
      </label>
      <label class="field">
        <span>Qty</span>
        <input type="number" min="1" step="1" value="${item.qty}" data-action="${qtyAction}">
      </label>
      <label class="field readonly-field">
        <span>Line Total</span>
        <input type="text" value="${formatMoney(lineTotal)}" data-role="line-total" readonly>
      </label>
      <button type="button" class="line-item-remove" data-action="${removeAction}">Remove</button>
    </div>
  `;
}

function updateCounts(platform,orders){
  const total=orders.length;
  const complete=orders.filter(isComplete).length;
  document.getElementById(`count-${platform}`).textContent=`${complete} / ${total} complete`;
}

function setActivePlatform(platform){
  if(!platforms.includes(platform)){return;}
  uiState.activePlatform=platform;
  elements.platformTabs.forEach((tab)=>{
    const isActive=tab.dataset.platformTab===platform;
    tab.classList.toggle("is-active",isActive);
    tab.setAttribute("aria-pressed",String(isActive));
  });
  elements.platformBoards.forEach((board)=>board.classList.toggle("is-active",board.dataset.platformBoard===platform));
}

function addOrder(platform){
  const dateKey=getDateKey();
  const draft=getDraft(platform);
  const draftElements=getDraftElements(platform);
  const orderId=sanitizeOrderId(draft.orderId);
  const catalogMap=buildCatalogMap(readCatalog());
  const preparedItems=prepareDraftItemsForSave(platform,catalogMap);
  const totalSales=normalizeMoney(draft.totalSales);
  const hasSalesValue=typeof draft.totalSales==="string"&&draft.totalSales.trim()!=="";
  if(!dateKey){showMessage("Select a date before adding an order.","error");elements.date.focus();return;}
  if(!orderId){showDraftMessage(platform,"Order ID is required.","error");draftElements.orderId.focus();return;}
  if(hasSalesValue&&totalSales===null){showDraftMessage(platform,"Total Sales must be a valid number.","error");draftElements.orderSales.focus();return;}
  if(preparedItems.error){showDraftMessage(platform,preparedItems.error,"error");return;}
  const store=readStore();
  const day=ensureDay(store,dateKey);
  const alreadyExists=day.platforms[platform].some((order)=>order.id.toLowerCase()===orderId.toLowerCase());
  if(alreadyExists){showDraftMessage(platform,`${platform} order ${orderId} already exists for this date.`,"error");draftElements.orderId.focus();return;}
  day.platforms[platform].unshift({uid:buildUid("order"),id:orderId,items:preparedItems.items,totalSales,courier:courierOptions[0],picture:false,pickup:false});
  uiState.activePlatform=platform;
  writeStore(store);
  resetDraft(platform);
  clearDraftFormDom(platform);
  clearMessage();
  refreshPlatformList(platform);
  showDraftMessage(platform,`${platform} order ${orderId} added.`,"success");
  getDraftElements(platform).orderId.focus();
}

function prepareDraftItemsForSave(platform,catalogMap){
  const normalized=getDraft(platform).items.map((item)=>{
    const sku=sanitizeSku(item.sku||"");
    const catalogEntry=sku?catalogMap.get(sku):null;
    return{
      uid:buildUid("line"),
      sku,
      item:sku?(catalogEntry?.item??item.item??""):"",
      qty:normalizeQuantity(item.qty),
      srp:sku?(catalogEntry?.srp??item.srp??null):null
    };
  }).filter((item)=>item.sku);
  if(!normalized.length){return{items:[],error:"Add at least one valid SKU line before saving the order."};}
  if(normalized.some((item)=>item.qty===null||item.srp===null)){
    return{items:[],error:"Each SKU line needs a valid SKU and quantity."};
  }
  return{items:mergeLineItems(normalized)};
}

function saveApproval(){
  const dateKey=getDateKey();
  if(!dateKey){return;}
  const store=readStore();
  const day=ensureDay(store,dateKey);
  day.approval={preparedBy:elements.preparedBy.value.trim()||defaultApproval.preparedBy,checkedBy:elements.checkedBy.value.trim()||defaultApproval.checkedBy};
  writeStore(store);
}

function handleDraftSectionClick(event){
  const action=event.target.dataset.action;
  const platform=event.target.dataset.platform||event.target.closest("[data-draft-platform]")?.dataset.draftPlatform;
  if(!action||!platform){return;}
  if(action==="add-draft-line"){
    getDraft(platform).items.push(createLineItem());
    clearDraftMessage(platform);
    updateDraftButtonState(platform);
    renderDraftSection(platform,readCatalog());
    refreshPlatformList(platform);
    return;
  }
  if(action==="remove-draft-line"){
    const lineId=event.target.closest("[data-line-id]")?.dataset.lineId;
    if(!lineId){return;}
    const draft=getDraft(platform);
    draft.items=draft.items.filter((item)=>item.uid!==lineId);
    clearDraftMessage(platform);
    updateDraftButtonState(platform);
    renderDraftSection(platform,readCatalog());
    refreshPlatformList(platform);
    return;
  }
  if(action==="add-order"){addOrder(platform);}
}

function handleDraftSectionInput(event){
  const platform=event.target.closest("[data-draft-platform]")?.dataset.draftPlatform;
  if(!platform){return;}
  const draft=getDraft(platform);
  const action=event.target.dataset.action;
  if(event.target.id===`orderId-${platform}`){
    draft.orderId=event.target.value;
    clearDraftMessage(platform);
    updateDraftButtonState(platform);
    refreshPlatformList(platform);
    return;
  }
  if(event.target.id===`orderSales-${platform}`){
    draft.totalSales=event.target.value;
    clearDraftMessage(platform);
    updateDraftButtonState(platform);
    refreshPlatformList(platform);
    return;
  }
  const line=findDraftLine(platform,event.target);
  if(!line){return;}
  if(action==="draft-line-sku"){
    const catalogMap=buildCatalogMap(readCatalog());
    line.sku=sanitizeSku(event.target.value);
    line.item=line.sku?(catalogMap.get(line.sku)?.item??""):"";
    line.srp=line.sku?(catalogMap.get(line.sku)?.srp??null):null;
    syncDraftLineRow(event.target,line);
    updateDraftTargetField(platform);
    clearDraftMessage(platform);
    updateDraftButtonState(platform);
    refreshPlatformList(platform);
    return;
  }
  if(action==="draft-line-qty"){
    line.qty=normalizeQuantity(event.target.value)??1;
    syncDraftLineRow(event.target,line);
    updateDraftTargetField(platform);
    clearDraftMessage(platform);
    updateDraftButtonState(platform);
    refreshPlatformList(platform);
  }
}

function handleDraftSectionChange(event){
  const platform=event.target.closest("[data-draft-platform]")?.dataset.draftPlatform;
  const action=event.target.dataset.action;
  if(!platform||!action){return;}
  const line=findDraftLine(platform,event.target);
  if(!line){return;}
  if(action==="draft-line-sku"){
    const catalogMap=buildCatalogMap(readCatalog());
    line.sku=sanitizeSku(event.target.value);
    line.item=line.sku?(catalogMap.get(line.sku)?.item??""):"";
    line.srp=line.sku?(catalogMap.get(line.sku)?.srp??null):null;
  }
  if(action==="draft-line-qty"){line.qty=normalizeQuantity(event.target.value)??1;}
  syncDraftLineRow(event.target,line);
  updateDraftTargetField(platform);
  updateDraftButtonState(platform);
  refreshPlatformList(platform);
}

function handleSavedOrderClick(event){
  const action=event.target.dataset.action;
  if(!action){return;}
  const order=findSavedOrder(event.target);
  if(!order){return;}
  if(action==="toggle-line-details"){
    const lineId=event.target.closest("[data-line-id]")?.dataset.lineId;
    if(!lineId){return;}
    uiState.expandedLineId=uiState.expandedLineId===lineId?null:lineId;
    refreshPlatformList(order.platform);
    return;
  }
  if(action==="remove-order"){removeOrder(order.platform,order.record.uid);return;}
  if(action==="add-line"){
    const firstCatalogItem=readCatalog()[0];
    const newLine=createLineItem({
      sku:firstCatalogItem?.sku||"",
      item:firstCatalogItem?.item||"",
      srp:firstCatalogItem?.srp??null,
      qty:1
    });
    order.record.items.push(newLine);
    uiState.expandedLineId=newLine.uid;
    persistSavedOrderChanges(order.store,order.platform);
    return;
  }
  if(action==="remove-line"){
    const lineId=event.target.closest("[data-line-id]")?.dataset.lineId;
    order.record.items=order.record.items.filter((item)=>item.uid!==lineId);
    if(uiState.expandedLineId===lineId){uiState.expandedLineId=null;}
    persistSavedOrderChanges(order.store,order.platform);
  }
}

function handleSavedOrderChange(event){
  const action=event.target.dataset.action;
  if(!action){return;}
  const order=findSavedOrder(event.target);
  if(!order){return;}
  if(action==="courier"){order.record.courier=courierOptions.includes(event.target.value)?event.target.value:courierOptions[0];}
  if(action==="totalSales"){order.record.totalSales=normalizeMoney(event.target.value);}
  if(action==="picture"){order.record.picture=event.target.checked;}
  if(action==="pickup"){order.record.pickup=event.target.checked;}
  if(action==="line-sku"||action==="line-qty"){
    const line=findSavedLineItem(order.record,event.target);
    if(!line){return;}
    if(action==="line-sku"){
      const catalogMap=buildCatalogMap(readCatalog());
      line.sku=sanitizeSku(event.target.value);
      line.item=line.sku?(catalogMap.get(line.sku)?.item??""):"";
      line.srp=line.sku?(catalogMap.get(line.sku)?.srp??null):null;
    }
    if(action==="line-qty"){line.qty=normalizeQuantity(event.target.value)??1;}
    order.record.items=mergeLineItems(order.record.items);
  }
  persistSavedOrderChanges(order.store,order.platform);
}

function removeOrder(platform,uid){
  const store=readStore();
  const day=ensureDay(store,getDateKey());
  day.platforms[platform]=day.platforms[platform].filter((order)=>order.uid!==uid);
  writeStore(store);
  refreshPlatformList(platform);
  showMessage(`Removed order from ${platform}.`,"success");
}

function persistSavedOrderChanges(store,platform){
  const day=ensureDay(store,getDateKey());
  day.platforms=normalizePlatforms(day.platforms);
  writeStore(store);
  refreshPlatformList(platform);
}

function normalizePlatforms(platformData){
  const normalized={};
  platforms.forEach((platform)=>{
    normalized[platform]=(platformData[platform]||[]).map((order)=>({...order,items:mergeLineItems(order.items||[])}));
  });
  return normalized;
}

function syncDraftItemsWithCatalog(catalogMap){
  platforms.forEach((platform)=>{
    const draft=getDraft(platform);
    draft.items=draft.items.map((item)=>({
      ...item,
      sku:sanitizeSku(item.sku||""),
      item:item.sku?(catalogMap.get(sanitizeSku(item.sku))?.item??item.item??""):"",
      srp:item.sku?(catalogMap.get(sanitizeSku(item.sku))?.srp??null):null,
      qty:normalizeQuantity(item.qty)??1
    }));
  });
}

function syncOrdersWithCatalog(store,catalogMap){
  Object.values(store).forEach((day)=>{
    if(!day?.platforms){return;}
    platforms.forEach((platform)=>{
      day.platforms[platform].forEach((order)=>{
        order.items=mergeLineItems((order.items||[]).map((item)=>{
          const sku=sanitizeSku(item.sku||"");
          return{
            ...item,
            sku,
            item:sku?(catalogMap.get(sku)?.item??item.item??""):"",
            srp:sku?(catalogMap.get(sku)?.srp??item.srp??null):item.srp,
            qty:normalizeQuantity(item.qty)??1
          };
        }));
      });
    });
  });
}

function buildCatalogMap(catalog){return new Map(catalog.map((entry)=>[entry.sku,entry]));}

function buildSkuOptionsHtml(catalog,selectedSku){
  const options=['<option value="">Select SKU</option>'];
  const seen=new Set();
  catalog.forEach((entry)=>{
    seen.add(entry.sku);
    const selected=entry.sku===selectedSku?" selected":"";
    options.push(`<option value="${escapeHtml(entry.sku)}"${selected}>${escapeHtml(entry.sku)}</option>`);
  });
  if(selectedSku&&!seen.has(selectedSku)){options.push(`<option value="${escapeHtml(selectedSku)}" selected>${escapeHtml(selectedSku)}</option>`);}
  return options.join("");
}

function mergeLineItems(items){
  const merged=new Map();
  items.forEach((item)=>{
    const normalized=normalizeLineItem(item);
    if(!isMeaningfulLineItem(normalized)){return;}
    const key=normalized.sku||normalized.uid;
    if(!merged.has(key)){merged.set(key,{...normalized});return;}
    const existing=merged.get(key);
    existing.qty+=normalized.qty;
    existing.srp=normalized.srp??existing.srp;
  });
  return Array.from(merged.values());
}

function findDraftLine(platform,target){
  const row=target.closest("[data-line-id]");
  return row?getDraft(platform).items.find((item)=>item.uid===row.dataset.lineId)||null:null;
}

function findSavedOrder(target){
  const orderElement=target.closest(".order-item");
  if(!orderElement){return null;}
  const platform=orderElement.dataset.platform;
  const uid=orderElement.dataset.uid;
  const store=readStore();
  const day=ensureDay(store,getDateKey());
  const record=day.platforms[platform].find((entry)=>entry.uid===uid);
  return record?{store,day,platform,record}:null;
}

function findSavedLineItem(order,target){
  const lineId=target.closest("[data-line-id]")?.dataset.lineId;
  return lineId?order.items.find((item)=>item.uid===lineId)||null:null;
}

function updateDraftTargetField(platform){
  const draftElements=getDraftElements(platform);
  if(draftElements.orderTarget){
    draftElements.orderTarget.value=formatMoney(getLineItemsTarget(getDraft(platform).items));
  }
}

function syncDraftLineRow(target,line){
  const row=target.closest(".line-item-row");
  if(!row){return;}
  const itemNameField=row.querySelector('[data-role="item-name"]');
  const unitSrpField=row.querySelector('[data-role="unit-srp"]');
  const lineTotalField=row.querySelector('[data-role="line-total"]');
  const itemValue=line.item||"Select a SKU";
  const unitValue=formatMoney(line.srp);
  const totalValue=formatMoney(getLineItemTotal(line));
  if(itemNameField){
    if("value" in itemNameField){itemNameField.value=itemValue;}
    else{itemNameField.textContent=itemValue;}
  }
  if(unitSrpField){
    if("value" in unitSrpField){unitSrpField.value=unitValue;}
    else{unitSrpField.textContent=`SRP ${unitValue}`;}
  }
  if(lineTotalField){
    if("value" in lineTotalField){lineTotalField.value=totalValue;}
    else{lineTotalField.textContent=`Total ${totalValue}`;}
  }
}

function showDraftMessage(platform,message,tone=""){
  const draft=getDraft(platform);
  draft.message=message;
  draft.messageTone=tone;
  const draftElements=getDraftElements(platform);
  if(!draftElements.formMessage){return;}
  draftElements.formMessage.textContent=message;
  draftElements.formMessage.className="form-message";
  if(tone){draftElements.formMessage.classList.add(tone);}
}

function clearDraftMessage(platform){
  showDraftMessage(platform,"");
}

function hasDraftContent(draft){
  if(!draft){return false;}
  if(sanitizeOrderId(draft.orderId)){return true;}
  if(typeof draft.totalSales==="string"&&draft.totalSales.trim()!==""){return true;}
  return draft.items.some((item)=>sanitizeSku(item.sku||""));
}

function isComplete(order){return order.picture&&order.pickup;}

function getLineItemTotal(item){
  if(item.srp===null){return null;}
  return Number((item.srp*item.qty).toFixed(2));
}

function getLineItemsTarget(items){
  const meaningful=items.filter(isMeaningfulLineItem);
  if(!meaningful.length){return null;}
  return meaningful.reduce((total,item)=>total+(getLineItemTotal(item)||0),0);
}

function getSalesOutcome(order){
  const orderTarget=getLineItemsTarget(order.items);
  if(orderTarget===null||order.totalSales===null){return{label:"Pending sales",tone:"pending"};}
  if(order.totalSales>orderTarget){return{label:`Win | ${formatMoney(order.totalSales)} vs ${formatMoney(orderTarget)}`,tone:"win"};}
  if(order.totalSales<orderTarget){return{label:`Lose | ${formatMoney(order.totalSales)} vs ${formatMoney(orderTarget)}`,tone:"lose"};}
  return{label:`Break-even | ${formatMoney(order.totalSales)}`,tone:"even"};
}

function normalizeMoney(value){
  if(value===""||value===null||value===undefined){return null;}
  const amount=Number(value);
  if(!Number.isFinite(amount)||amount<0){return null;}
  return Number(amount.toFixed(2));
}

function normalizeQuantity(value){
  if(value===""||value===null||value===undefined){return 1;}
  const amount=Number(value);
  if(!Number.isInteger(amount)||amount<1){return null;}
  return amount;
}

function buildSummaryItemsLabel(items){
  if(!items.length){return "-";}
  return items.map((item)=>`${item.item||item.sku||"Unknown"} x${item.qty}`).join(", ");
}

function formatMoney(value){
  if(value===null||value===undefined||!Number.isFinite(value)){return "0.00";}
  return Number(value).toFixed(2);
}

function printSummary(){
  const dateKey=getDateKey();
  const store=readStore();
  const day=store[dateKey];
  if(!dateKey||!day){showMessage("There is no saved data for this date yet.","error");return;}
  const daySummary=buildDaySummary(day);
  const summarySections=platforms.map((platform)=>buildSummaryTable(platform,day.platforms[platform])).filter(Boolean).join("");
  if(!summarySections){showMessage("Add at least one order before printing the summary.","error");return;}
  const printWindow=window.open("","","width=960,height=720");
  if(!printWindow){showMessage("The summary window was blocked. Please allow pop-ups and try again.","error");return;}
  const preparedBy=escapeHtml(day.approval.preparedBy);
  const checkedBy=escapeHtml(day.approval.checkedBy);
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Daily Orders Summary</title>
      <style>
        body{font-family:"Segoe UI",Arial,sans-serif;padding:16px;color:#142033;font-size:12px;}
        h1{margin:0 0 8px;font-size:22px;}
        h2{margin:0 0 8px;font-size:15px;}
        p{margin:0 0 4px;}
        .summary-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;}
        .summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:14px;}
        .summary-card{padding:8px 10px;border:1px solid #d7deea;border-radius:8px;background:#f8fbff;}
        .summary-card-label{margin:0 0 4px;font-size:10px;color:#5e6b82;text-transform:uppercase;letter-spacing:.08em;}
        .summary-card-value{margin:0;font-size:16px;font-weight:700;}
        .courier-table{margin-bottom:16px;}
        .courier-table td:last-child,.courier-table th:last-child{text-align:right;}
        .table-total td{font-weight:700;background:#f8fbff;}
        img{max-width:140px;max-height:54px;object-fit:contain;}
        table{width:100%;border-collapse:collapse;margin-bottom:16px;}
        th,td{border:1px solid #d7deea;padding:6px 7px;text-align:left;vertical-align:top;font-size:11px;}
        th{background:#f4f7fb;font-size:10px;}
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
      ${buildSummaryOverviewHtml(daySummary)}
      ${buildCourierTotalsTable(daySummary.courierTotals)}
      ${summarySections}
      <script>window.onload=()=>window.print()<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function buildSummaryTable(platform,orders){
  if(!orders||!orders.length){return "";}
  const totals=buildOrderCollectionSummary(orders);
  const rows=orders.map((order)=>`
    <tr>
      <td>${escapeHtml(order.id)}</td>
      <td>${escapeHtml(buildSummaryItemsLabel(order.items))}</td>
      <td>${formatMoney(getLineItemsTarget(order.items))}</td>
      <td>${order.totalSales===null?"-":formatMoney(order.totalSales)}</td>
      <td>${escapeHtml(order.courier)}</td>
      <td>${order.picture?"Yes":"No"}</td>
      <td>${order.pickup?"Yes":"No"}</td>
      <td>${isComplete(order)?"Completed":"Pending"}</td>
      <td>${getSalesOutcome(order).label}</td>
    </tr>
  `).join("");
  return `
    <section>
      <h2>${escapeHtml(platform)}</h2>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Items</th>
            <th>SRP Total</th>
            <th>Total Sales</th>
            <th>Courier</th>
            <th>Picture Sent</th>
            <th>Picked Up</th>
            <th>Status</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="table-total">
            <td colspan="2">Totals</td>
            <td>${formatMoney(totals.srpTotal)}</td>
            <td>${formatMoney(totals.salesTotal)}</td>
            <td>${totals.courierSummary}</td>
            <td>${totals.pictureSent}</td>
            <td>${totals.pickedUp}</td>
            <td>${totals.completed}</td>
            <td>${totals.notPickedUp} not picked up</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

function buildOrderCollectionSummary(orders){
  const summary={
    totalOrders:orders.length,
    srpTotal:0,
    salesTotal:0,
    notPickedUp:0,
    pictureSent:0,
    pickedUp:0,
    completed:0,
    courierCounts:{}
  };
  orders.forEach((order)=>{
    summary.srpTotal+=getLineItemsTarget(order.items)||0;
    summary.salesTotal+=order.totalSales||0;
    if(order.picture){summary.pictureSent+=1;}
    if(order.pickup){summary.pickedUp+=1;}else{summary.notPickedUp+=1;}
    if(isComplete(order)){summary.completed+=1;}
    summary.courierCounts[order.courier]=(summary.courierCounts[order.courier]||0)+1;
  });
  summary.courierSummary=Object.entries(summary.courierCounts).map(([courier,count])=>`${escapeHtml(courier)}: ${count}`).join(", ") || "-";
  return summary;
}

function buildDaySummary(day){
  const allOrders=platforms.flatMap((platform)=>day.platforms[platform]||[]);
  const totals=buildOrderCollectionSummary(allOrders);
  return{
    ...totals,
    courierTotals:Object.entries(totals.courierCounts).sort((left,right)=>left[0].localeCompare(right[0]))
  };
}

function buildSummaryOverviewHtml(summary){
  return `
    <section class="summary-grid">
      <div class="summary-card">
        <p class="summary-card-label">Total Orders</p>
        <p class="summary-card-value">${summary.totalOrders}</p>
      </div>
      <div class="summary-card">
        <p class="summary-card-label">SRP Total</p>
        <p class="summary-card-value">${formatMoney(summary.srpTotal)}</p>
      </div>
      <div class="summary-card">
        <p class="summary-card-label">Total Sales</p>
        <p class="summary-card-value">${formatMoney(summary.salesTotal)}</p>
      </div>
      <div class="summary-card">
        <p class="summary-card-label">Not Picked Up</p>
        <p class="summary-card-value">${summary.notPickedUp}</p>
      </div>
    </section>
  `;
}

function buildCourierTotalsTable(courierTotals){
  if(!courierTotals.length){
    return "";
  }
  const rows=courierTotals.map(([courier,count])=>`
    <tr>
      <td>${escapeHtml(courier)}</td>
      <td>${count}</td>
    </tr>
  `).join("");
  return `
    <section>
      <h2>Courier Totals</h2>
      <table class="courier-table">
        <thead>
          <tr>
            <th>Courier</th>
            <th>Total Orders</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>
  `;
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
}

function showMessage(message,tone=""){
  elements.topMessage.textContent=message;
  elements.topMessage.className="form-message";
  if(tone){elements.topMessage.classList.add(tone);}
}

function clearMessage(){showMessage("");}
