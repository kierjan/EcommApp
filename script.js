const STORAGE_KEY="orders";
const THEME_KEY="themePreference";
const platforms=["Shopee","Lazada","TikTok"];
const courierOptions=["J&T","Flash","SPX"];
const orderStatuses=["active","cancelled","returned"];
const defaultApproval={preparedBy:"Adrian 1",checkedBy:"Larah"};
const elements={};
const uiState={activeView:"orders",activePlatform:"Shopee",drafts:{},draftOpen:{},expandedLineId:null,openCancelRequestOrderId:null,cancelRequestDrafts:{},orderSearch:"",store:{},sync:{mode:"checking",label:"Checking sync",detail:"Waiting for Firebase status...",meta:"Local cache stays available if the connection drops."}};

document.addEventListener("DOMContentLoaded",async()=>{
  cacheElements();
  bindEvents();
  elements.date.value=getTodayLocalISO();
  ensureDraftState();
  applySavedTheme();
  await waitForFirebaseBridge();
  reportFirebaseStatus();
  await renderApp();
});

function cacheElements(){
  elements.date=document.getElementById("date");
  elements.orderSearch=document.getElementById("orderSearch");
  elements.skuOptions=document.getElementById("skuOptions");
  elements.preparedBy=document.getElementById("preparedBy");
  elements.checkedBy=document.getElementById("checkedBy");
  elements.importShopeeBtn=document.getElementById("importShopeeBtn");
  elements.shopeeImportInput=document.getElementById("shopeeImportInput");
  elements.importLazadaBtn=document.getElementById("importLazadaBtn");
  elements.lazadaImportInput=document.getElementById("lazadaImportInput");
  elements.markAllPicture=document.getElementById("markAllPicture");
  elements.markAllPickup=document.getElementById("markAllPickup");
  elements.topMessage=document.getElementById("topMessage");
  elements.syncBadge=document.getElementById("syncBadge");
  elements.syncStatusText=document.getElementById("syncStatusText");
  elements.syncStatusMeta=document.getElementById("syncStatusMeta");
  elements.printSummaryBtn=document.getElementById("printSummaryBtn");
  elements.themeToggleBtn=document.getElementById("themeToggleBtn");
  elements.downloadSummaryBtn=document.getElementById("downloadSummaryBtn");
  elements.viewTabs=Array.from(document.querySelectorAll("[data-view-tab]"));
  elements.viewTabBadges={
    orders:document.querySelector('[data-view-count="orders"]'),
    requests:document.querySelector('[data-view-count="requests"]'),
    cancelled:document.querySelector('[data-view-count="cancelled"]'),
    returned:document.querySelector('[data-view-count="returned"]')
  };
  elements.viewSections=Array.from(document.querySelectorAll("[data-view-section]"));
  elements.platformTabs=Array.from(document.querySelectorAll("[data-platform-tab]"));
  elements.platformTabCounts={
    Shopee:document.querySelector('[data-platform-count="Shopee"]'),
    Lazada:document.querySelector('[data-platform-count="Lazada"]'),
    TikTok:document.querySelector('[data-platform-count="TikTok"]')
  };
  elements.platformBoards=Array.from(document.querySelectorAll("[data-platform-board]"));
  elements.orderLists=Array.from(document.querySelectorAll(".order-list"));
}

async function waitForFirebaseBridge(timeoutMs=2500){
  if(window.firebaseBridge){return window.firebaseBridge;}
  return new Promise((resolve)=>{
    let settled=false;
    const finish=(bridge)=>{
      if(settled){return;}
      settled=true;
      clearTimeout(timer);
      window.removeEventListener("firebase-bridge-ready",handleReady);
      resolve(bridge||window.firebaseBridge||null);
    };
    const handleReady=(event)=>finish(event.detail);
    const timer=window.setTimeout(()=>finish(window.firebaseBridge),timeoutMs);
    window.addEventListener("firebase-bridge-ready",handleReady,{once:true});
  });
}

function reportFirebaseStatus(){
  if(location.protocol==="file:"&&window.FIREBASE_OPTIONS?.enabled){
    console.warn("Firebase cannot connect from a file:// page. Use http://localhost instead.");
    setSyncState({mode:"error",label:"Local only",detail:"Firebase is blocked on file:// pages.",meta:"Open the app through http://localhost:4173 so Firestore can connect."});
    showMessage("Firebase will not sync from file:/// pages. Open the app through http://localhost instead.","error");
    return;
  }
  const bridge=window.firebaseBridge;
  if(!bridge){return;}
  if(bridge.status==="ready"){
    console.info("Firebase sync is ready.");
    setSyncState({mode:"connected",label:"Connected",detail:"Firebase sync is ready.",meta:"Orders for the selected date are loading from Firestore."});
    return;
  }
  if(window.FIREBASE_OPTIONS?.enabled){
    console.warn("Firebase sync is not ready. Falling back to local storage.",bridge.status,bridge.error||"");
    setSyncState({mode:"local",label:"Local cache",detail:`Firebase is not ready (${bridge.status}).`,meta:"The app can still use local browser storage until the connection comes back."});
    showMessage(`Firebase sync is not ready (${bridge.status}). The app is using local storage for now.`,"error");
  }
}


function applySavedTheme(){
  const savedTheme=localStorage.getItem(THEME_KEY);
  const isDark=savedTheme==="dark";
  document.body.classList.toggle("dark-mode",isDark);
  updateThemeToggleLabel(isDark);
}

function toggleTheme(){
  const isDark=!document.body.classList.contains("dark-mode");
  document.body.classList.toggle("dark-mode",isDark);
  localStorage.setItem(THEME_KEY,isDark?"dark":"light");
  updateThemeToggleLabel(isDark);
}

function updateThemeToggleLabel(isDark){
  if(!elements.themeToggleBtn){return;}
  elements.themeToggleBtn.textContent=isDark?"☀️ Light Mode":"🌙 Dark Mode";
  elements.themeToggleBtn.setAttribute("aria-pressed",String(isDark));
}
function bindEvents(){
  elements.printSummaryBtn.addEventListener("click",printSummary);
  elements.themeToggleBtn?.addEventListener("click",toggleTheme);
  elements.downloadSummaryBtn.addEventListener("click",()=>{void downloadSummaryImage();});
  elements.date.addEventListener("change",async()=>{
      resetAllDrafts();
      clearMessage();
      await renderApp();
    });
    elements.orderSearch.addEventListener("input",()=>{
      uiState.orderSearch=elements.orderSearch.value;
      refreshDayViews();
    });
  elements.preparedBy.addEventListener("input",saveApproval);
  elements.checkedBy.addEventListener("input",saveApproval);
  elements.importShopeeBtn?.addEventListener("click",()=>elements.shopeeImportInput?.click());
  elements.shopeeImportInput?.addEventListener("change",(event)=>{void handleShopeeImport(event);});
  elements.importLazadaBtn?.addEventListener("click",()=>elements.lazadaImportInput?.click());
  elements.lazadaImportInput?.addEventListener("change",(event)=>{void handleLazadaImport(event);});
  elements.markAllPicture.addEventListener("change",()=>{void applyBatchOrderCheck("picture",elements.markAllPicture.checked);});
  elements.markAllPickup.addEventListener("change",()=>{void applyBatchOrderCheck("pickup",elements.markAllPickup.checked);});
  elements.viewTabs.forEach((tab)=>tab.addEventListener("click",()=>setActiveView(tab.dataset.viewTab)));
  elements.platformTabs.forEach((tab)=>tab.addEventListener("click",()=>setActivePlatform(tab.dataset.platformTab)));
    platforms.forEach((platform)=>{
      const draftSection=document.querySelector(`[data-draft-platform="${platform}"]`);
      if(!draftSection){return;}
      const openDraftBtn=document.getElementById(`openDraftBtn-${platform}`);
      if(openDraftBtn){
        openDraftBtn.addEventListener("click",()=>{
          uiState.draftOpen[platform]=!isDraftExpanded(platform);
          renderDraftSection(platform,readCatalog());
          if(uiState.draftOpen[platform]){
            getDraftElements(platform).orderId?.focus();
          }
        });
      }
      draftSection.addEventListener("click",handleDraftSectionClick);
    draftSection.addEventListener("input",handleDraftSectionInput);
    draftSection.addEventListener("change",handleDraftSectionChange);
    draftSection.addEventListener("keydown",(event)=>{
      if(event.key==="Enter"&&event.target.id===`orderId-${platform}`){
        event.preventDefault();
        addOrder(platform);
      }
    });
  });
  elements.orderLists.forEach((list)=>{
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
function normalizeLookupText(value){return typeof value==="string"?value.trim().toLowerCase().replace(/\s+/g," "):"";}

async function readStore(options={}){
  if(!options.forceReload&&uiState.store&&Object.keys(uiState.store).length){
    return normalizeStore(uiState.store);
  }
  try{
    const bridge=window.firebaseBridge;
    if(bridge?.status==="ready"){
      const remoteStore=normalizeStore(await bridge.loadStore());
      syncStoreToLocalCache(remoteStore);
      setSyncState({mode:"connected",label:"Connected",detail:"Loaded data from Firebase.",meta:"Firestore is the primary source of truth for saved orders."});
      return remoteStore;
    }
    if(window.FIREBASE_OPTIONS?.enabled){
      console.warn("Reading from local storage because Firebase bridge is not ready.",bridge?.status||"missing");
      setSyncState({mode:"local",label:"Local cache",detail:"Using local browser data.",meta:"Firebase is not available right now, so the app is reading cached data."});
    }
    const rawValue=localStorage.getItem(STORAGE_KEY);
    const localStore=rawValue?normalizeStore(JSON.parse(rawValue)):{};
    uiState.store=localStore;
    return localStore;
  }catch(error){
    console.error("Unable to read saved orders:",error);
    showMessage("Saved data was unreadable. The app reset to protect the page.","error");
    try{localStorage.removeItem(STORAGE_KEY);}catch(removeError){}
    uiState.store={};
    return {};
  }
}

function normalizeDayRecord(rawDay){
  const normalizedStore=normalizeStore(rawDay?{temp:rawDay}:{});
  return normalizedStore.temp||null;
}

function syncStoreToLocalCache(store){
  const normalized=normalizeStore(store);
  uiState.store=normalized;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(normalized));
  return normalized;
}

async function readDay(dateKey,{forceReload=false}={}){
  if(!dateKey){return null;}
  if(!forceReload&&uiState.store?.[dateKey]){
    return normalizeDayRecord(uiState.store[dateKey]);
  }
  const bridge=window.firebaseBridge;
  if(bridge?.status==="ready"){
    try{
      const remoteDay=normalizeDayRecord(await bridge.loadDay(dateKey));
      const nextStore=normalizeStore(uiState.store||{});
      if(remoteDay){nextStore[dateKey]=remoteDay;}
      else{delete nextStore[dateKey];}
      syncStoreToLocalCache(nextStore);
      setSyncState({mode:"connected",label:"Connected",detail:`Loaded ${dateKey} from Firebase.`,meta:buildSyncMeta("Firestore is live.",new Date())});
      return remoteDay;
    }catch(error){
      console.error(`Unable to read Firebase day ${dateKey}:`,error);
      setSyncState({mode:"local",label:"Local cache",detail:`Could not load ${dateKey} from Firebase.`,meta:"Showing local cached data for this date while the connection is unavailable."});
      showMessage("Could not load this date from Firebase. Showing local data if available.","error");
    }
  }
  const store=await readStore({forceReload});
  return normalizeDayRecord(store[dateKey]);
}

async function writeStore(store,{suppressMessage=false}={}){
  const normalized=syncStoreToLocalCache(store);
  const bridge=window.firebaseBridge;
  if(bridge?.status==="ready"){
    try{
      await bridge.saveStore(normalized);
      setSyncState({mode:"connected",label:"Connected",detail:"Changes synced to Firebase.",meta:buildSyncMeta("Firestore is the primary source of truth.",new Date())});
    }catch(error){
      console.error("Unable to write Firebase store:",error);
      setSyncState({mode:"local",label:"Local cache",detail:"Saved locally, but Firebase store sync failed.",meta:"Your browser still has the latest data, but Firestore did not accept this write."});
      if(!suppressMessage){
        showMessage("Saved locally, but Firebase sync failed. Check Firestore rules/config.","error");
      }
    }
  }else if(window.FIREBASE_OPTIONS?.enabled){
    console.warn("Saved to local storage because Firebase bridge is not ready.",bridge?.status||"missing");
    setSyncState({mode:"local",label:"Local cache",detail:"Saved only in this browser.",meta:"Firebase is not connected, so these changes are not yet synced to Firestore."});
    if(!suppressMessage){
      showMessage("Saved locally only. Firebase is not connected yet.","error");
    }
  }
}

async function writeDay(dateKey,day,{suppressMessage=false}={}){
  if(!dateKey){return;}
  const normalizedStore=normalizeStore(uiState.store||{});
  normalizedStore[dateKey]=normalizeDayRecord(day)||ensureDay({},dateKey);
  syncStoreToLocalCache(normalizedStore);
  const bridge=window.firebaseBridge;
  if(bridge?.status==="ready"){
    try{
      await bridge.saveDay(dateKey,normalizedStore[dateKey]);
      setSyncState({mode:"connected",label:"Connected",detail:`Synced ${dateKey} to Firebase.`,meta:buildSyncMeta("Latest save reached Firestore.",new Date())});
    }catch(error){
      console.error(`Unable to write Firebase day ${dateKey}:`,error);
      setSyncState({mode:"local",label:"Local cache",detail:`Saved ${dateKey} locally, but Firebase sync failed.`,meta:"The browser cache has the latest version, but Firestore did not finish this save."});
      if(!suppressMessage){
        showMessage("Saved locally, but Firebase sync failed for this date.","error");
      }
    }
  }else if(window.FIREBASE_OPTIONS?.enabled){
    console.warn("Saved day locally because Firebase bridge is not ready.",bridge?.status||"missing");
    setSyncState({mode:"local",label:"Local cache",detail:`Saved ${dateKey} only in this browser.`,meta:"Firebase is not connected, so the current day has not been synced to Firestore yet."});
    if(!suppressMessage){
      showMessage("Saved locally only. Firebase is not connected yet.","error");
    }
  }
}

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

function normalizeOrderStatus(value){
  return orderStatuses.includes(value)?value:"active";
}

function normalizeCancelRequest(rawRequest){
  const message=typeof rawRequest?.message==="string"?rawRequest.message.trim():"";
  if(!message){return null;}
  return{
    message,
    createdAt:typeof rawRequest?.createdAt==="string"?rawRequest.createdAt:""
  };
}

function normalizeOrder(rawOrder){
  const safeId=sanitizeOrderId(rawOrder?.id);
  const safeCourier=courierOptions.includes(rawOrder?.courier)?rawOrder.courier:courierOptions[0];
  const items=Array.isArray(rawOrder?.items)?rawOrder.items.map((item)=>normalizeLineItem(item)).filter(isMeaningfulLineItem):buildLegacyItems(rawOrder);
  return{uid:typeof rawOrder?.uid==="string"&&rawOrder.uid?rawOrder.uid:buildUid("order"),id:safeId,items,totalSales:normalizeMoney(rawOrder?.totalSales),srpTotal:normalizeMoney(rawOrder?.srpTotal),buyerPayment:normalizeMoney(rawOrder?.buyerPayment),courier:safeCourier,picture:Boolean(rawOrder?.picture),pickup:Boolean(rawOrder?.pickup),invoiceRequested:Boolean(rawOrder?.invoiceRequested),status:normalizeOrderStatus(rawOrder?.status),reason:typeof rawOrder?.reason==="string"?rawOrder.reason.trim():"",note:typeof rawOrder?.note==="string"?rawOrder.note.trim():"",createdAt:normalizeImportedCreatedAt(rawOrder?.createdAt),createdSequence:normalizeImportedSequence(rawOrder?.createdSequence),cancelRequest:normalizeCancelRequest(rawOrder?.cancelRequest)};
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

function isMeaningfulLineItem(item){return Boolean(item?.sku||item?.item||item?.srp!==null);}

function ensureDraftState(){
  platforms.forEach((platform)=>{
    if(!uiState.drafts[platform]){
      uiState.drafts[platform]=buildEmptyDraft();
    }
    if(typeof uiState.draftOpen[platform]!=="boolean"){
      uiState.draftOpen[platform]=false;
    }
  });
}

function buildEmptyDraft(){
  return{orderId:"",totalSales:"",courier:"",items:[],message:"",messageTone:""};
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
    boardEntry:document.querySelector(`[data-draft-platform="${platform}"]`),
    orderId:document.getElementById(`orderId-${platform}`),
    orderSales:document.getElementById(`orderSales-${platform}`),
    orderCourier:document.getElementById(`orderCourier-${platform}`),
    orderTarget:document.getElementById(`orderTarget-${platform}`),
    orderItemRows:document.getElementById(`orderItemRows-${platform}`),
    addOrderBtn:document.getElementById(`addOrderBtn-${platform}`),
    openDraftBtn:document.getElementById(`openDraftBtn-${platform}`),
    formMessage:document.getElementById(`formMessage-${platform}`)
  };
}

function isDraftExpanded(platform){
  ensureDraftState();
  return Boolean(uiState.draftOpen[platform]||hasDraftContent(getDraft(platform)));
}

async function renderApp(){
  const dateKey=getDateKey();
  const store=await readStore();
  const catalog=readCatalog();
  const catalogMap=buildCatalogMap(catalog);
  syncOrdersWithCatalog(store,catalogMap);
  ensureDraftState();
  renderSkuDatalist(catalog);
  syncDraftItemsWithCatalog(catalogMap);
  if(!dateKey){
    updateViewTabBadges({totalOrders:0,pendingRequests:0,cancelled:0,returned:0});
    updatePlatformTabCounts({platforms:Object.fromEntries(platforms.map((platform)=>[platform,[]]))});
    updateBatchCheckStates({platforms:Object.fromEntries(platforms.map((platform)=>[platform,[]]))});
    platforms.forEach((platform)=>{
      renderDraftSection(platform,catalog);
      renderPlatform(platform,[],catalog);
      renderRequestPlatformList(platform,[]);
      renderStatusPlatformList("cancelled",platform,[],catalog);
      renderStatusPlatformList("returned",platform,[],catalog);
    });
    setActivePlatform(uiState.activePlatform);
    setActiveView(uiState.activeView);
    return;
  }
  const day=normalizeDayRecord(await readDay(dateKey,{forceReload:true}))||ensureDay(store,dateKey);
  store[dateKey]=day;
  elements.preparedBy.value=day.approval.preparedBy;
  elements.checkedBy.value=day.approval.checkedBy;
  renderDayViews(day,catalog);
  syncStoreToLocalCache(store);
  writeCatalog(catalog);
}

function renderDayViews(day,catalog){
  if(elements.orderSearch&&elements.orderSearch.value!==uiState.orderSearch){
    elements.orderSearch.value=uiState.orderSearch;
  }
  platforms.forEach((platform)=>{
    const platformOrders=day.platforms[platform]||[];
    renderDraftSection(platform,catalog);
    renderPlatform(platform,filterOrdersByOrderId(getOrdersForStatus(platformOrders,"active")),catalog);
    renderRequestPlatformList(platform,filterOrdersByOrderId(getOrdersWithCancelRequest(platformOrders)));
    renderStatusPlatformList("cancelled",platform,filterOrdersByOrderId(getOrdersForStatus(platformOrders,"cancelled")),catalog);
    renderStatusPlatformList("returned",platform,filterOrdersByOrderId(getOrdersForStatus(platformOrders,"returned")),catalog);
  });
  updateViewTabBadges(buildDaySummary(day));
  updatePlatformTabCounts(day);
  updateBatchCheckStates(day);
  setActivePlatform(uiState.activePlatform);
  setActiveView(uiState.activeView);
}

function renderSkuDatalist(catalog){
  const options=[];
  const seen=new Set();
  catalog.forEach((entry)=>{
    const skuKey=`sku:${entry.sku}`;
    if(!seen.has(skuKey)){
      seen.add(skuKey);
      options.push(`<option value="${escapeHtml(entry.sku)}" label="${escapeHtml(entry.item)}"></option>`);
    }
    const itemLabel=(entry.item||"").trim();
    const itemKey=`item:${normalizeLookupText(itemLabel)}`;
    if(itemLabel&&!seen.has(itemKey)){
      seen.add(itemKey);
      options.push(`<option value="${escapeHtml(itemLabel)}" label="${escapeHtml(entry.sku)}"></option>`);
    }
  });
  elements.skuOptions.innerHTML=options.join("");
}

function renderDraftSection(platform,catalog){
  const draft=getDraft(platform);
  const draftElements=getDraftElements(platform);
  const isOpen=isDraftExpanded(platform);
  if(draftElements.boardEntry){draftElements.boardEntry.classList.toggle("is-collapsed",!isOpen);}
  if(draftElements.openDraftBtn){draftElements.openDraftBtn.textContent=isOpen?"Close Form":"Add Order";}
  draftElements.orderId.value=draft.orderId;
  draftElements.orderSales.value=draft.totalSales;
  if(draftElements.orderCourier){draftElements.orderCourier.value=draft.courier||"";}
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
  const displayOrders=sortOrdersForDisplay(orders);
  if(hasDraftContent(draft)){
    list.appendChild(createDraftOrderCard(platform,draft));
  }
  if(!displayOrders.length&&!hasDraftContent(draft)){
    const emptyItem=document.createElement("li");
    emptyItem.className="empty-state";
    emptyItem.textContent=`No ${platform} orders for this date yet.`;
    list.appendChild(emptyItem);
    updateCounts(platform,displayOrders);
    return;
  }
  displayOrders.forEach((order,index)=>list.appendChild(createOrderCard(platform,order,catalog,index)));
  updateCounts(platform,displayOrders);
}

function renderStatusPlatformList(status,platform,orders,catalog){
  const list=document.getElementById(getStatusListId(status,platform));
  if(!list){return;}
  list.innerHTML="";
  const displayOrders=sortOrdersForDisplay(orders);
  if(!displayOrders.length){
    const emptyItem=document.createElement("li");
    emptyItem.className="empty-state";
    emptyItem.textContent=`No ${platform} ${getStatusLabel(status).toLowerCase()} orders for this date yet.`;
    list.appendChild(emptyItem);
    updateArchiveCount(status,platform,displayOrders.length);
    return;
  }
  displayOrders.forEach((order,index)=>list.appendChild(createOrderCard(platform,order,catalog,index)));
  updateArchiveCount(status,platform,displayOrders.length);
}

function renderRequestPlatformList(platform,orders){
  const list=document.getElementById(getRequestListId(platform));
  if(!list){return;}
  list.innerHTML="";
  if(!orders.length){
    const emptyItem=document.createElement("li");
    emptyItem.className="empty-state";
    emptyItem.textContent=`No ${platform} cancel requests for this date yet.`;
    list.appendChild(emptyItem);
    updateRequestCount(platform,0);
    return;
  }
  orders.forEach((order,index)=>list.appendChild(createCancelRequestCard(platform,order,index)));
  updateRequestCount(platform,orders.length);
}

function refreshDayViews(){
  const catalog=readCatalog();
  const store=normalizeStore(uiState.store||{});
  const dateKey=getDateKey();
  const day=dateKey?ensureDay(store,dateKey):{approval:{...defaultApproval},platforms:Object.fromEntries(platforms.map((platform)=>[platform,[]]))};
  renderDayViews(day,catalog);
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
  if(draftElements.orderCourier){draftElements.orderCourier.value="";}
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
  const meaningfulItems=draft.items.filter((line)=>isMeaningfulLineItem(line));
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

function hasPendingCancelRequest(order){
  return Boolean(order?.cancelRequest?.message&&normalizeOrderStatus(order.status)==="active");
}

function getCancelRequestDraft(order){
  return typeof uiState.cancelRequestDrafts[order.uid]==="string"?uiState.cancelRequestDrafts[order.uid]:"";
}

function createCancelRequestCard(platform,order,index=0){
  const item=document.createElement("li");
  item.className="order-item request-order-item";
  item.dataset.uid=order.uid;
  item.dataset.platform=platform;
  const request=order.cancelRequest;
  item.innerHTML=`
    <div class="order-top">
      <div class="order-id">
        <span class="status-dot" aria-hidden="true"></span>
        <span>Order #${index+1} · ${escapeHtml(order.id)}</span>
      </div>
      <div class="order-top-actions">
        <span class="request-pill">${orderNumberLabel}</span>
        <span class="request-pill">Cancel request</span>
      </div>
    </div>
    <div class="request-card-copy">
      <p class="request-card-reason">${escapeHtml(request?.message||"-")}</p>
      <p class="request-card-meta">Courier: ${escapeHtml(order.courier)} | Total Sales: ${formatMoney(order.totalSales)}</p>
    </div>
    <div class="button-row compact-row">
      <button type="button" class="secondary-btn compact-btn" data-action="reject-cancel-request">Reject</button>
      <button type="button" class="primary-btn compact-btn" data-action="approve-cancel-request">Accept Cancel</button>
    </div>
  `;
  return item;
}

function buildOrderNoteHtml(order){
  if(!order.note){return "";}
  return `
    <div class="order-note-box">
      <p class="order-note-label">Note</p>
      <p class="order-note-copy">${escapeHtml(order.note)}</p>
    </div>
  `;
}

function createOrderCard(platform,order,catalog,index=0){
  const item=document.createElement("li");
  item.className="order-item";
  item.dataset.uid=order.uid;
  item.dataset.platform=platform;
  const orderState=normalizeOrderStatus(order.status);
  if(isComplete(order)){item.classList.add("is-complete");}
  if(orderState==="cancelled"){item.classList.add("is-cancelled");}
  if(orderState==="returned"){item.classList.add("is-returned");}
  const salesOutcome=getSalesOutcome(order);
  const createdMeta=order.createdAt?`<span class="item-count-indicator">${escapeHtml(formatOrderCreatedAt(order.createdAt))}</span>`:"";
  const courierOptionsHtml=courierOptions.map((option)=>{
    const selected=order.courier===option?" selected":"";
    return `<option value="${option}"${selected}>${option}</option>`;
  }).join("");
  const statusOptionsHtml=orderStatuses.map((status)=>{
    const selected=orderState===status?" selected":"";
    return `<option value="${status}"${selected}>${getStatusLabel(status)}</option>`;
  }).join("");
  const hasCancelRequest=hasPendingCancelRequest(order);
  const orderNumberLabel=`Order #${index+1}`;
  const cancelRequestBoxHtml=orderState!=="active"?"":hasCancelRequest?`
    <div class="cancel-request-box is-pending">
      <div class="cancel-request-head">
        <span class="request-pill">Cancel request pending</span>
      </div>
      <p class="cancel-request-copy">${escapeHtml(order.cancelRequest?.message||"")}</p>
    </div>
  `:uiState.openCancelRequestOrderId===order.uid?`
    <div class="cancel-request-box">
      <div class="cancel-request-head">
        <span class="section-label">Cancel Request</span>
      </div>
      <textarea class="reason-input" data-action="cancel-request-draft" rows="2" placeholder="Why does this order need to be cancelled?">${escapeHtml(getCancelRequestDraft(order))}</textarea>
      <div class="reason-actions">
        <button type="button" class="secondary-btn compact-btn" data-action="close-cancel-request">Close</button>
        <button type="button" class="primary-btn compact-btn" data-action="save-cancel-request">Send Request</button>
      </div>
    </div>
  `:"";
  const reasonFieldHtml=orderState==="active"?"":`
    <div class="field reason-field">
      <span>${getStatusLabel(orderState)} Reason</span>
      <textarea class="reason-input" data-action="reason" rows="2" placeholder="Enter the reason">${escapeHtml(order.reason||"")}</textarea>
      <div class="reason-actions">
        <button type="button" class="primary-btn compact-btn reason-save-btn" data-action="save-reason">Save Reason</button>
      </div>
    </div>
  `;
  item.innerHTML=`
    <div class="order-top">
      <div class="order-id">
        <span class="status-dot" aria-hidden="true"></span>
        <span>Order #${index+1} · ${escapeHtml(order.id)}</span>
      </div>
      <div class="order-top-actions">
        <span class="item-count-indicator">${order.items.length} item${order.items.length===1?"":"s"}</span>
        <span class="request-pill">${orderNumberLabel}</span>
        ${createdMeta}
        ${orderState==="active"&&!hasCancelRequest?'<button type="button" class="secondary-btn compact-btn" data-action="toggle-cancel-request">Request Cancel</button>':""}
        ${hasCancelRequest?'<span class="request-pill">Pending request</span>':""}
        <button type="button" class="remove-btn" data-action="remove-order">Remove</button>
      </div>
    </div>
    <div class="saved-line-items">${buildSavedLineItemsHtml(order.items,catalog)}</div>
    ${cancelRequestBoxHtml}
    ${buildOrderNoteHtml(order)}
    <div class="button-row compact-row">
      <button type="button" class="secondary-btn compact-btn" data-action="add-line">Add SKU Line</button>
    </div>
    <div class="meta-row">
      <label class="field">
        <span>SRP Total</span>
        <input type="number" min="0" step="0.01" value="${formatOrderSrpTotalInput(order)}" data-action="srpTotal" placeholder="0.00">
      </label>
      <label class="field">
        <span>Buyer Payment</span>
        <input type="number" min="0" step="0.01" value="${order.buyerPayment===null?"":order.buyerPayment.toFixed(2)}" data-action="buyerPayment" placeholder="0.00">
      </label>
      <label class="field">
        <span>Total Sales</span>
        <input type="number" min="0" step="0.01" class="sales-input" data-action="totalSales" value="${order.totalSales===null?"":order.totalSales.toFixed(2)}" placeholder="0.00">
      </label>
      <label class="field">
        <span>Courier</span>
        <select class="courier-select" data-action="courier">${courierOptionsHtml}</select>
      </label>
      <label class="field">
        <span>Order Status</span>
        <select class="status-select" data-action="status">${statusOptionsHtml}</select>
      </label>
      ${reasonFieldHtml}
    </div>
      <div class="order-checks">
        <label class="check-item"><input type="checkbox" data-action="picture" ${order.picture?"checked":""}><span>Picture sent</span></label>
        <label class="check-item"><input type="checkbox" data-action="pickup" ${order.pickup?"checked":""}><span>Picked up</span></label>
      </div>
    <div class="status-row">
      <p class="status-text">${getOrderLifecycleLabel(order)}</p>
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

function findCatalogEntryBySearch(value,catalog){
  const rawValue=typeof value==="string"?value.trim():"";
  if(!rawValue){return null;}
  const normalizedSku=sanitizeSku(rawValue);
  const normalizedText=normalizeLookupText(rawValue);
  if(normalizedSku){
    const exactSku=catalog.find((entry)=>entry.sku===normalizedSku);
    if(exactSku){return exactSku;}
  }
  if(normalizedText){
    const exactItem=catalog.find((entry)=>normalizeLookupText(entry.item)===normalizedText);
    if(exactItem){return exactItem;}
  }
  if(normalizedSku){
    const partialSku=catalog.find((entry)=>entry.sku.includes(normalizedSku));
    if(partialSku){return partialSku;}
  }
  if(normalizedText){
    const partialItem=catalog.find((entry)=>normalizeLookupText(entry.item).includes(normalizedText));
    if(partialItem){return partialItem;}
  }
  return null;
}

function buildLineItemRowHtml(item,catalog,mode){
  const lineTotal=getLineItemTotal(item);
  const removeAction=mode==="draft"?"remove-draft-line":"remove-line";
  const skuAction=mode==="draft"?"draft-line-sku":"line-sku";
  const qtyAction=mode==="draft"?"draft-line-qty":"line-qty";
  const srpAction=mode==="draft"?"draft-line-srp":"line-srp";
  const lookupValue=item.sku||item.item||"";
  const qtyValue=item.qty===""?"":String(item.qty??1);
  if(mode==="draft"){
        return `
          <div class="line-item-row draft-line-row" data-line-id="${item.uid}">
          <label class="field draft-sku-field">
            <span>SKU</span>
            <input type="text" list="skuOptions" value="${escapeHtml(lookupValue)}" data-action="${skuAction}" placeholder="Search SKU or item">
          </label>
          <label class="field draft-srp-field">
            <span>SRP</span>
            <input type="number" min="0" step="0.01" value="${item.srp===null?"":formatMoney(item.srp)}" data-action="${srpAction}" data-role="unit-srp" placeholder="0.00">
          </label>
            <label class="field draft-qty-field">
              <span>Qty</span>
              <input type="number" min="1" step="1" value="${qtyValue}" data-action="${qtyAction}">
            </label>
          <button type="button" class="line-item-remove" data-action="${removeAction}">Remove</button>
          <div class="draft-line-caption">
            <span class="draft-line-item" data-role="item-name">${escapeHtml(item.item||"Type an item or choose from the catalog")}</span>
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
          <input type="text" list="skuOptions" value="${escapeHtml(lookupValue)}" data-action="${skuAction}" placeholder="Search SKU or item">
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

function getOrdersForStatus(orders,status){
  return (orders||[]).filter((order)=>normalizeOrderStatus(order.status)===status);
}

function getOrdersWithCancelRequest(orders){
  return (orders||[]).filter((order)=>normalizeOrderStatus(order.status)==="active"&&hasPendingCancelRequest(order));
}

function filterOrdersByOrderId(orders){
  const query=sanitizeOrderId(uiState.orderSearch).toLowerCase();
  if(!query){return orders||[];}
  return (orders||[]).filter((order)=>sanitizeOrderId(order.id).toLowerCase().includes(query));
}

function sortOrdersForDisplay(orders){
  return [...(orders||[])].sort((left,right)=>{
    const rightSequence=getOrderDisplaySequence(right);
    const leftSequence=getOrderDisplaySequence(left);
    if(rightSequence!==leftSequence){return rightSequence-leftSequence;}
    return String(right.id||"").localeCompare(String(left.id||""));
  });
}

function getOrderDisplaySequence(order){
  if(Number.isFinite(order?.createdSequence)){return order.createdSequence;}
  const parsed=Date.parse(order?.createdAt||"");
  if(!Number.isNaN(parsed)){return parsed;}
  return 0;
}

function getStatusLabel(status){
  return status==="cancelled"?"Cancelled":status==="returned"?"Returned":"Active";
}

function getStatusListId(status,platform){
  return `${status.charAt(0).toUpperCase()+status.slice(1)}-${platform}`;
}

function getRequestListId(platform){
  return `Requests-${platform}`;
}

function updateCounts(platform,orders){
  const total=orders.length;
  const complete=orders.filter(isComplete).length;
  document.getElementById(`count-${platform}`).textContent=`${complete} / ${total} complete`;
}

function updateArchiveCount(status,platform,total){
  const label=status==="cancelled"?"cancelled":"returned";
  const element=document.getElementById(`count-${status.charAt(0).toUpperCase()+status.slice(1)}-${platform}`);
  if(element){element.textContent=`${total} ${label}`;}
}

function updatePlatformTabCounts(day){
  const sourcePlatforms=day?.platforms||{};
  platforms.forEach((platform)=>{
    const allOrders=sourcePlatforms[platform]||[];
    let visibleOrders=allOrders;
    if(uiState.activeView==="orders"){
      visibleOrders=getOrdersForStatus(allOrders,"active");
    }else if(uiState.activeView==="requests"){
      visibleOrders=getOrdersWithCancelRequest(allOrders);
    }else if(uiState.activeView==="cancelled"){
      visibleOrders=getOrdersForStatus(allOrders,"cancelled");
    }else if(uiState.activeView==="returned"){
      visibleOrders=getOrdersForStatus(allOrders,"returned");
    }
    const count=filterOrdersByOrderId(visibleOrders).length;
    const countElement=elements.platformTabCounts?.[platform];
    if(countElement){
      countElement.textContent=`(${count})`;
      countElement.setAttribute("aria-label",`${count} ${platform} orders`);
    }
  });
}

function updateBatchCheckStates(day){
  const activeOrders=platforms.flatMap((platform)=>getOrdersForStatus(day?.platforms?.[platform]||[],"active"));
  const hasOrders=activeOrders.length>0;
  const allPictureSent=hasOrders&&activeOrders.every((order)=>order.picture);
  const allPickedUp=hasOrders&&activeOrders.every((order)=>order.pickup);

  if(elements.markAllPicture){
    elements.markAllPicture.checked=allPictureSent;
    elements.markAllPicture.disabled=!hasOrders;
  }
  if(elements.markAllPickup){
    elements.markAllPickup.checked=allPickedUp;
    elements.markAllPickup.disabled=!hasOrders;
  }
}

async function applyBatchOrderCheck(field,checked){
  const dateKey=getDateKey();
  if(!dateKey){return;}
  const store=normalizeStore(uiState.store||await readStore());
  const day=ensureDay(store,dateKey);
  const activeOrders=platforms.flatMap((platform)=>getOrdersForStatus(day.platforms[platform]||[],"active"));
  if(!activeOrders.length){
    showMessage("There are no active orders to update for this date.","error");
    updateBatchCheckStates(day);
    return;
  }

  activeOrders.forEach((order)=>{order[field]=checked;});
  await writeDay(dateKey,day,{suppressMessage:true});
  refreshDayViews();
  showMessage(`${field==="picture"?"Picture sent":"Picked up"} updated for all active orders.`,"success");
}

function updateRequestCount(platform,total){
  const element=document.getElementById(`count-Requests-${platform}`);
  if(element){element.textContent=`${total} request${total===1?"":"s"}`;}
}

function updateViewTabBadges(summary){
  const activeCount=Math.max(0,(summary?.totalOrders||0)-(summary?.cancelled||0)-(summary?.returned||0));
  const counts={
    orders:activeCount,
    requests:summary?.pendingRequests||0,
    cancelled:summary?.cancelled||0,
    returned:summary?.returned||0
  };
  const labels={
    orders:"active orders",
    requests:"cancel requests",
    cancelled:"cancelled orders",
    returned:"returned orders"
  };

  Object.entries(elements.viewTabBadges||{}).forEach(([view,badge])=>{
    if(!badge){return;}
    const count=counts[view]||0;
    badge.textContent=String(count);
    badge.setAttribute("aria-label",`${count} ${labels[view]||view}`);
  });
}

function setActiveView(view){
  const safeView=["orders","requests","cancelled","returned"].includes(view)?view:"orders";
  uiState.activeView=safeView;
  elements.viewTabs.forEach((tab)=>{
    const isActive=tab.dataset.viewTab===safeView;
    tab.classList.toggle("is-active",isActive);
    tab.setAttribute("aria-pressed",String(isActive));
  });
  elements.viewSections.forEach((section)=>section.classList.toggle("is-active",section.dataset.viewSection===safeView));
  const dateKey=getDateKey();
  const day=dateKey?ensureDay(normalizeStore(uiState.store||{}),dateKey):{platforms:Object.fromEntries(platforms.map((platform)=>[platform,[]]))};
  updatePlatformTabCounts(day);
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

async function addOrder(platform){
  const dateKey=getDateKey();
  const draft=getDraft(platform);
  const draftElements=getDraftElements(platform);
  const orderId=sanitizeOrderId(draft.orderId);
  const selectedCourier=courierOptions.includes(draft.courier)?draft.courier:"";
  const catalogMap=buildCatalogMap(readCatalog());
  const preparedItems=prepareDraftItemsForSave(platform,catalogMap);
  const totalSales=normalizeMoney(draft.totalSales);
  const hasSalesValue=typeof draft.totalSales==="string"&&draft.totalSales.trim()!=="";
  if(!dateKey){showMessage("Select a date before adding an order.","error");elements.date.focus();return;}
  if(!orderId){showDraftMessage(platform,"Order ID is required.","error");draftElements.orderId.focus();return;}
  if(!selectedCourier){showDraftMessage(platform,"Courier is required.","error");draftElements.orderCourier?.focus();return;}
  if(hasSalesValue&&totalSales===null){showDraftMessage(platform,"Total Sales must be a valid number.","error");draftElements.orderSales.focus();return;}
  if(preparedItems.error){showDraftMessage(platform,preparedItems.error,"error");return;}
  const store=normalizeStore(uiState.store||await readStore());
  const day=ensureDay(store,dateKey);
  const alreadyExists=day.platforms[platform].some((order)=>order.id.toLowerCase()===orderId.toLowerCase());
  if(alreadyExists){showDraftMessage(platform,`${platform} order ${orderId} already exists for this date.`,"error");draftElements.orderId.focus();return;}
  day.platforms[platform].push({uid:buildUid("order"),id:orderId,items:preparedItems.items,totalSales,srpTotal:null,buyerPayment:null,courier:selectedCourier,picture:false,pickup:false,status:"active",createdAt:"",createdSequence:null});
  uiState.activePlatform=platform;
  uiState.activeView="orders";
  await writeDay(dateKey,day);
  resetDraft(platform);
  uiState.draftOpen[platform]=false;
  clearDraftFormDom(platform);
  clearMessage();
  refreshDayViews();
  showDraftMessage(platform,`${platform} order ${orderId} added.`,"success");
  getDraftElements(platform).openDraftBtn?.focus();
}

function prepareDraftItemsForSave(platform,catalogMap){
  const normalized=getDraft(platform).items.map((item)=>{
    const sku=sanitizeSku(item.sku||"");
    const catalogEntry=sku?catalogMap.get(sku):null;
    const itemName=typeof item.item==="string"?item.item.trim():"";
    return{
      uid:buildUid("line"),
      sku:catalogEntry?sku:"",
      item:catalogEntry?.item??itemName,
      qty:normalizeQuantity(item.qty),
      srp:catalogEntry?.srp??normalizeMoney(item.srp)
    };
  }).filter((item)=>item.sku||item.item);
  if(!normalized.length){return{items:[],error:"Add at least one valid SKU line before saving the order."};}
  if(normalized.some((item)=>item.qty===null||item.srp===null||!item.item)){
    return{items:[],error:"Each SKU line needs an item, SRP, and quantity."};
  }
  return{items:mergeLineItems(normalized)};
}

async function saveApproval(){
  const dateKey=getDateKey();
  if(!dateKey){return;}
  const store=normalizeStore(uiState.store||await readStore());
  const day=ensureDay(store,dateKey);
  day.approval={preparedBy:elements.preparedBy.value.trim()||defaultApproval.preparedBy,checkedBy:elements.checkedBy.value.trim()||defaultApproval.checkedBy};
  await writeDay(dateKey,day,{suppressMessage:true});
}

async function handleShopeeImport(event){
  const file=event.target?.files?.[0];
  if(!file){return;}
  const dateKey=getDateKey();
  if(!dateKey){
    showMessage("Select a date before importing Shopee orders.","error");
    resetShopeeImportInput();
    return;
  }
  if(typeof window.XLSX?.read!=="function"||typeof window.XLSX?.utils?.sheet_to_json!=="function"){
    showMessage("Spreadsheet import is not available right now. Reload the page and try again.","error");
    resetShopeeImportInput();
    return;
  }

  showMessage("Importing Shopee to ship file...","success");

  try{
    const buffer=await file.arrayBuffer();
    const workbook=window.XLSX.read(buffer,{type:"array",cellDates:true});
    const rows=getShopeeImportRows(workbook);
    const parsedImport=parseShopeeImportRows(rows,readCatalog());
    if(!parsedImport.orders.length){
      showMessage("No valid Shopee orders were found in that file.","error");
      resetShopeeImportInput();
      return;
    }

    const store=normalizeStore(uiState.store||await readStore());
    const day=ensureDay(store,dateKey);
    const result=upsertImportedShopeeOrders(day.platforms.Shopee||[],parsedImport.orders);
    day.platforms.Shopee=result.orders;
    uiState.activePlatform="Shopee";
    uiState.activeView="orders";
    await writeDay(dateKey,day);
    refreshDayViews();

    const reviewText=parsedImport.needsReview?` ${parsedImport.needsReview} item line${parsedImport.needsReview===1?"":"s"} need SRP review.`:"";
    showMessage(`Shopee import complete. ${result.added} added, ${result.updated} updated.${reviewText}`,"success");
  }catch(error){
    console.error("Unable to import Shopee file:",error);
    showMessage("Could not import that Shopee file. Check the file format and try again.","error");
  }finally{
    resetShopeeImportInput();
  }
}

async function handleLazadaImport(event){
  const file=event.target?.files?.[0];
  if(!file){return;}
  const dateKey=getDateKey();
  if(!dateKey){
    showMessage("Select a date before importing Lazada orders.","error");
    resetLazadaImportInput();
    return;
  }
  if(typeof window.XLSX?.read!=="function"||typeof window.XLSX?.utils?.sheet_to_json!=="function"){
    showMessage("Spreadsheet import is not available right now. Reload the page and try again.","error");
    resetLazadaImportInput();
    return;
  }

  showMessage("Importing Lazada file...","success");

  try{
    const buffer=await file.arrayBuffer();
    const workbook=window.XLSX.read(buffer,{type:"array",cellDates:true});
    const rows=getSpreadsheetImportRows(workbook).slice(1);
    const parsedImport=parseLazadaImportRows(rows,readCatalog());
    if(!parsedImport.orders.length){
      showMessage("No valid Lazada orders were found in that file.","error");
      resetLazadaImportInput();
      return;
    }

    const store=normalizeStore(uiState.store||await readStore());
    const day=ensureDay(store,dateKey);
    const result=upsertImportedOrders(day.platforms.Lazada||[],parsedImport.orders);
    day.platforms.Lazada=result.orders;
    uiState.activePlatform="Lazada";
    uiState.activeView="orders";
    await writeDay(dateKey,day);
    refreshDayViews();

    const reviewText=parsedImport.needsReview?` ${parsedImport.needsReview} item line${parsedImport.needsReview===1?"":"s"} need SRP review.`:"";
    showMessage(`Lazada import complete. ${result.added} added, ${result.updated} updated.${reviewText}`,"success");
  }catch(error){
    console.error("Unable to import Lazada file:",error);
    showMessage("Could not import that Lazada file. Check the file format and try again.","error");
  }finally{
    resetLazadaImportInput();
  }
}

function resetShopeeImportInput(){
  if(elements.shopeeImportInput){elements.shopeeImportInput.value="";}
}

function resetLazadaImportInput(){
  if(elements.lazadaImportInput){elements.lazadaImportInput.value="";}
}

function getShopeeImportRows(workbook){
  return getSpreadsheetImportRows(workbook).slice(1);
}

function getSpreadsheetImportRows(workbook){
  const firstSheetName=workbook.SheetNames?.[0];
  const sheet=firstSheetName?workbook.Sheets[firstSheetName]:null;
  if(!sheet){return [];}
  return window.XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:false});
}

function parseShopeeImportRows(rows,catalog){
  const groupedOrders=new Map();
  let needsReview=0;

  rows.forEach((row,rowIndex)=>{
    const orderId=sanitizeOrderId(row[0]);
    if(!orderId){return;}

    const quantity=normalizeQuantity(row[17]);
    if(quantity===null){return;}

    const shippingOption=typeof row[5]==="string"?row[5].trim():String(row[5]||"").trim();
    const skuReference=sanitizeSku(row[13]);
    const variationName=typeof row[14]==="string"?row[14].trim():String(row[14]||"").trim();
    if(!skuReference&&!variationName){return;}
    const buyerPayment=normalizeMoney(row[34]);
    const note=typeof row[53]==="string"?row[53].trim():String(row[53]||"").trim();
    const invoiceRequestType=typeof row[54]==="string"?row[54].trim():String(row[54]||"").trim();
    const catalogEntry=findCatalogEntryBySearch(skuReference||variationName,catalog);
    const lineItem={
      uid:buildUid("line"),
      sku:catalogEntry?.sku??skuReference,
      item:catalogEntry?.item??(variationName||skuReference||"Unknown item"),
      srp:catalogEntry?.srp??null,
      qty:quantity
    };
    if(lineItem.srp===null){needsReview+=1;}

    const createdSequence=parseShopeeImportSequence(row[9],rowIndex);
    const createdAt=normalizeImportedCreatedAt(row[9]);
    const existingGroup=groupedOrders.get(orderId);
    if(existingGroup){
      existingGroup.items.push(lineItem);
      existingGroup.sequence=Math.max(existingGroup.sequence,createdSequence);
      if(!existingGroup.createdAt&&createdAt){existingGroup.createdAt=createdAt;}
      if(note&&!existingGroup.note){existingGroup.note=note;}
      if(invoiceRequestType){existingGroup.invoiceRequested=true;}
      if(existingGroup.buyerPayment===null&&buyerPayment!==null){existingGroup.buyerPayment=buyerPayment;}
      if(!existingGroup.courier){existingGroup.courier=normalizeImportedCourier(shippingOption);}
      return;
    }

    groupedOrders.set(orderId,{
      id:orderId,
      items:[lineItem],
      courier:normalizeImportedCourier(shippingOption),
      buyerPayment:buyerPayment,
      invoiceRequested:Boolean(invoiceRequestType),
      note,
      createdAt,
      sequence:createdSequence
    });
  });

  const orders=Array.from(groupedOrders.values())
    .sort((left,right)=>right.sequence-left.sequence)
    .map((order)=>({
      uid:buildUid("order"),
      id:order.id,
      items:mergeLineItems(order.items),
      totalSales:null,
      srpTotal:null,
      buyerPayment:order.buyerPayment,
      courier:order.courier,
      picture:false,
      pickup:false,
      invoiceRequested:order.invoiceRequested,
      status:"active",
      reason:"",
      note:order.note,
      createdAt:order.createdAt,
      createdSequence:order.sequence,
      cancelRequest:null
    }));

  return{orders,needsReview};
}

function parseLazadaImportRows(rows,catalog){
  const groupedOrders=new Map();
  let needsReview=0;

  rows.forEach((row,rowIndex)=>{
    const orderId=sanitizeOrderId(row[0]);
    const skuReference=sanitizeSku(row[5]);
    if(!orderId||!skuReference){return;}

    const catalogEntry=findCatalogEntryBySearch(skuReference,catalog);
    const lineItem={
      uid:buildUid("line"),
      sku:catalogEntry?.sku??skuReference,
      item:catalogEntry?.item??skuReference,
      srp:catalogEntry?.srp??null,
      qty:1
    };
    if(lineItem.srp===null){needsReview+=1;}

    const buyerPayment=normalizeMoney(row[46]);
    const createdAt=normalizeImportedCreatedAt(row[8]);
    const createdSequence=parseImportSequence(row[8],rowIndex);
    const existingGroup=groupedOrders.get(orderId);
    if(existingGroup){
      existingGroup.items.push(lineItem);
      existingGroup.sequence=Math.max(existingGroup.sequence,createdSequence);
      if(!existingGroup.createdAt&&createdAt){existingGroup.createdAt=createdAt;}
      if(buyerPayment!==null){existingGroup.buyerPayment=(existingGroup.buyerPayment||0)+buyerPayment;}
      return;
    }

    groupedOrders.set(orderId,{
      id:orderId,
      items:[lineItem],
      buyerPayment:buyerPayment,
      createdAt,
      sequence:createdSequence
    });
  });

  const orders=Array.from(groupedOrders.values())
    .sort((left,right)=>right.sequence-left.sequence)
    .map((order)=>({
      uid:buildUid("order"),
      id:order.id,
      items:mergeLineItems(order.items),
      totalSales:null,
      srpTotal:null,
      buyerPayment:order.buyerPayment,
      courier:courierOptions[0],
      picture:false,
      pickup:false,
      invoiceRequested:false,
      status:"active",
      reason:"",
      note:"",
      createdAt:order.createdAt,
      createdSequence:order.sequence,
      cancelRequest:null
    }));

  return{orders,needsReview};
}

function parseShopeeImportSequence(value,rowIndex){
  return parseImportSequence(value,rowIndex);
}

function parseImportSequence(value,rowIndex){
  if(value instanceof Date&&!Number.isNaN(value.getTime())){return value.getTime();}
  if(typeof value==="number"&&Number.isFinite(value)){return value;}
  const rawValue=typeof value==="string"?value.trim():"";
  if(!rawValue){return rowIndex;}
  const parsedDate=Date.parse(rawValue);
  return Number.isNaN(parsedDate)?rowIndex:parsedDate;
}

function normalizeImportedSequence(value){
  const sequence=normalizeMoney(value);
  return sequence===null?null:sequence;
}

function normalizeImportedCreatedAt(value){
  if(value instanceof Date&&!Number.isNaN(value.getTime())){return value.toISOString();}
  if(typeof value==="number"&&Number.isFinite(value)){return "";}
  const rawValue=typeof value==="string"?value.trim():"";
  if(!rawValue){return "";}
  const parsedDate=Date.parse(rawValue);
  return Number.isNaN(parsedDate)?rawValue:new Date(parsedDate).toISOString();
}

function formatOrderCreatedAt(value){
  const parsedDate=Date.parse(value);
  if(Number.isNaN(parsedDate)){return value;}
  return new Date(parsedDate).toLocaleString([],{
    month:"short",
    day:"2-digit",
    hour:"2-digit",
    minute:"2-digit"
  });
}

function normalizeImportedCourier(value){
  const cleaned=typeof value==="string"?value.replace(/^Standard Local\s*-\s*/i,"").trim():"";
  if(!cleaned){return courierOptions[0];}
  const normalized=cleaned.toLowerCase();
  if(normalized.includes("j&t")||normalized.includes("j&t express")){return "J&T";}
  if(normalized.includes("flash")){return "Flash";}
  if(normalized.includes("spx")||normalized.includes("shopee xpress")){return "SPX";}
  return courierOptions.find((option)=>option.toLowerCase()===normalized)||courierOptions[0];
}

function upsertImportedShopeeOrders(existingOrders,importedOrders){
  return upsertImportedOrders(existingOrders,importedOrders);
}

function upsertImportedOrders(existingOrders,importedOrders){
  const nextOrders=[...(existingOrders||[])];
  let added=0;
  let updated=0;

  importedOrders.forEach((importedOrder)=>{
    const existingOrder=nextOrders.find((order)=>order.id.toLowerCase()===importedOrder.id.toLowerCase());
    if(existingOrder){
      existingOrder.items=importedOrder.items;
      existingOrder.buyerPayment=importedOrder.buyerPayment;
      existingOrder.courier=importedOrder.courier;
      existingOrder.invoiceRequested=importedOrder.invoiceRequested;
      existingOrder.note=importedOrder.note;
      existingOrder.createdAt=importedOrder.createdAt;
      existingOrder.createdSequence=importedOrder.createdSequence;
      updated+=1;
      return;
    }
    nextOrders.push(importedOrder);
    added+=1;
  });

  return{orders:nextOrders,added,updated};
}

function handleDraftSectionClick(event){
  const action=event.target.dataset.action;
  const platform=event.target.dataset.platform||event.target.closest("[data-draft-platform]")?.dataset.draftPlatform;
  if(!action||!platform){return;}
  if(action==="open-draft"){
    uiState.draftOpen[platform]=!isDraftExpanded(platform);
    renderDraftSection(platform,readCatalog());
    if(uiState.draftOpen[platform]){
      getDraftElements(platform).orderId?.focus();
    }
    return;
  }
  if(action==="add-draft-line"){
    uiState.draftOpen[platform]=true;
    getDraft(platform).items.push(createLineItem());
    clearDraftMessage(platform);
    updateDraftButtonState(platform);
    renderDraftSection(platform,readCatalog());
    refreshDayViews();
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
    refreshDayViews();
    return;
  }
  if(action==="add-order"){void addOrder(platform);}
}

function handleDraftSectionInput(event){
  const platform=event.target.closest("[data-draft-platform]")?.dataset.draftPlatform;
  if(!platform){return;}
  uiState.draftOpen[platform]=true;
  const draft=getDraft(platform);
  const action=event.target.dataset.action;
  if(event.target.id===`orderId-${platform}`){
    draft.orderId=event.target.value;
    clearDraftMessage(platform);
    updateDraftButtonState(platform);
    refreshDayViews();
    return;
  }
  if(event.target.id===`orderSales-${platform}`){
    draft.totalSales=event.target.value;
    clearDraftMessage(platform);
    updateDraftButtonState(platform);
    return;
  }
  if(event.target.id===`orderCourier-${platform}`){
    draft.courier=courierOptions.includes(event.target.value)?event.target.value:"";
    clearDraftMessage(platform);
    updateDraftButtonState(platform);
    refreshDayViews();
    return;
  }
  const line=findDraftLine(platform,event.target);
  if(!line){return;}
  if(action==="draft-line-sku"){
    clearDraftMessage(platform);
    return;
  }
  if(action==="draft-line-srp"){
    clearDraftMessage(platform);
    return;
  }
  if(action==="draft-line-qty"){
    line.qty=event.target.value;
    syncDraftLineRow(event.target,line);
    updateDraftTargetField(platform);
    clearDraftMessage(platform);
    updateDraftButtonState(platform);
    return;
  }
}

function handleDraftSectionChange(event){
  const platform=event.target.closest("[data-draft-platform]")?.dataset.draftPlatform;
  const action=event.target.dataset.action;
  if(!platform){return;}
  uiState.draftOpen[platform]=true;
  if(event.target.id===`orderSales-${platform}`){
    const draft=getDraft(platform);
    const formattedValue=normalizeMoney(event.target.value);
    draft.totalSales=event.target.value.trim()===""?"":formattedValue===null?event.target.value:formatMoney(formattedValue);
    if(formattedValue!==null){event.target.value=formatMoney(formattedValue);}
    clearDraftMessage(platform);
    updateDraftButtonState(platform);
    refreshDayViews();
    return;
  }
  if(event.target.id===`orderCourier-${platform}`){
    const draft=getDraft(platform);
    draft.courier=courierOptions.includes(event.target.value)?event.target.value:"";
    clearDraftMessage(platform);
    updateDraftButtonState(platform);
    refreshDayViews();
    return;
  }
  if(!action){return;}
  const line=findDraftLine(platform,event.target);
  if(!line){return;}
  if(action==="draft-line-sku"){
    const catalog=readCatalog();
    const catalogEntry=findCatalogEntryBySearch(event.target.value,catalog);
    const rawValue=typeof event.target.value==="string"?event.target.value.trim():"";
    line.sku=catalogEntry?.sku??"";
    line.item=catalogEntry?.item??rawValue;
    line.srp=catalogEntry?.srp??line.srp;
  }
  if(action==="draft-line-srp"){line.srp=normalizeMoney(event.target.value);}
  if(action==="draft-line-qty"){
    const rawQty=typeof event.target.value==="string"?event.target.value.trim():"";
    const normalizedQty=normalizeQuantity(rawQty);
    line.qty=rawQty===""?"":normalizedQty;
    if(normalizedQty!==null){event.target.value=String(normalizedQty);}
  }
  syncDraftLineRow(event.target,line);
  updateDraftTargetField(platform);
  updateDraftButtonState(platform);
  refreshDayViews();
}

async function handleSavedOrderClick(event){
  const action=event.target.dataset.action;
  if(!action){return;}
  const order=findSavedOrder(event.target);
  if(!order){return;}
  if(action==="toggle-line-details"){
    const lineId=event.target.closest("[data-line-id]")?.dataset.lineId;
    if(!lineId){return;}
    uiState.expandedLineId=uiState.expandedLineId===lineId?null:lineId;
    refreshDayViews();
    return;
  }
  if(action==="remove-order"){void removeOrder(order.platform,order.record.uid);return;}
  if(action==="toggle-cancel-request"){
    uiState.openCancelRequestOrderId=uiState.openCancelRequestOrderId===order.record.uid?null:order.record.uid;
    if(uiState.openCancelRequestOrderId===order.record.uid&&!Object.prototype.hasOwnProperty.call(uiState.cancelRequestDrafts,order.record.uid)){
      uiState.cancelRequestDrafts[order.record.uid]="";
    }
    refreshDayViews();
    return;
  }
  if(action==="close-cancel-request"){
    uiState.openCancelRequestOrderId=null;
    refreshDayViews();
    return;
  }
  if(action==="save-cancel-request"){
    const requestInput=event.target.closest(".cancel-request-box")?.querySelector('[data-action="cancel-request-draft"]');
    const requestMessage=requestInput?.value.trim()||"";
    if(!requestMessage){
      showMessage("Add the cancel reason before sending the request.","error");
      return;
    }
    order.record.cancelRequest={message:requestMessage,createdAt:new Date().toISOString()};
    uiState.cancelRequestDrafts[order.record.uid]="";
    uiState.openCancelRequestOrderId=null;
    uiState.activeView="requests";
    await persistSavedOrderChanges(order.store,order.platform);
    showMessage("Cancel request sent.","success");
    return;
  }
  if(action==="approve-cancel-request"){
    const requestMessage=order.record.cancelRequest?.message||"";
    order.record.status="cancelled";
    order.record.reason=requestMessage;
    order.record.cancelRequest=null;
    uiState.activeView="cancelled";
    await persistSavedOrderChanges(order.store,order.platform);
    showMessage("Cancel request accepted. The order moved to Cancelled.","success");
    return;
  }
  if(action==="reject-cancel-request"){
    order.record.cancelRequest=null;
    uiState.cancelRequestDrafts[order.record.uid]="";
    uiState.openCancelRequestOrderId=null;
    await persistSavedOrderChanges(order.store,order.platform);
    showMessage("Cancel request rejected.","success");
    return;
  }
  if(action==="save-reason"){
    const reasonInput=event.target.closest(".reason-field")?.querySelector('[data-action="reason"]');
    order.record.reason=reasonInput?.value.trim()||"";
    await persistSavedOrderChanges(order.store,order.platform);
    showMessage(`${getStatusLabel(order.record.status)} reason saved.`,"success");
    return;
  }
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
    void persistSavedOrderChanges(order.store,order.platform);
    return;
  }
  if(action==="remove-line"){
    const lineId=event.target.closest("[data-line-id]")?.dataset.lineId;
    order.record.items=order.record.items.filter((item)=>item.uid!==lineId);
    if(uiState.expandedLineId===lineId){uiState.expandedLineId=null;}
    void persistSavedOrderChanges(order.store,order.platform);
  }
}

function handleSavedOrderChange(event){
  const action=event.target.dataset.action;
  if(!action){return;}
  const order=findSavedOrder(event.target);
  if(!order){return;}
  if(action==="courier"){order.record.courier=courierOptions.includes(event.target.value)?event.target.value:courierOptions[0];}
  if(action==="cancel-request-draft"){
    uiState.cancelRequestDrafts[order.record.uid]=event.target.value;
    return;
  }
  if(action==="status"){
    order.record.status=normalizeOrderStatus(event.target.value);
    if(order.record.status==="active"){
      order.record.reason="";
      order.record.cancelRequest=null;
    }
    else{order.record.cancelRequest=null;}
    if(order.record.status==="cancelled"){uiState.activeView="cancelled";}
    else if(order.record.status==="returned"){uiState.activeView="returned";}
    else{uiState.activeView="orders";}
  }
  if(action==="reason"){order.record.reason=event.target.value.trim();}
  if(action==="totalSales"){
    order.record.totalSales=normalizeMoney(event.target.value);
    if(order.record.totalSales!==null){event.target.value=formatMoney(order.record.totalSales);}
  }
  if(action==="srpTotal"){
    order.record.srpTotal=normalizeMoney(event.target.value);
    if(order.record.srpTotal!==null){event.target.value=formatMoney(order.record.srpTotal);}
  }
  if(action==="buyerPayment"){
    order.record.buyerPayment=normalizeMoney(event.target.value);
    if(order.record.buyerPayment!==null){event.target.value=formatMoney(order.record.buyerPayment);}
  }
  if(action==="picture"){order.record.picture=event.target.checked;}
  if(action==="pickup"){order.record.pickup=event.target.checked;}
  if(action==="invoiceRequested"){order.record.invoiceRequested=event.target.checked;}
  if(action==="line-sku"||action==="line-srp"||action==="line-qty"){
    const line=findSavedLineItem(order.record,event.target);
    if(!line){return;}
    if(action==="line-sku"){
      const catalog=readCatalog();
      const catalogEntry=findCatalogEntryBySearch(event.target.value,catalog);
      const rawValue=typeof event.target.value==="string"?event.target.value.trim():"";
      line.sku=catalogEntry?.sku??"";
      line.item=catalogEntry?.item??rawValue;
      line.srp=catalogEntry?.srp??line.srp;
    }
    if(action==="line-srp"){line.srp=normalizeMoney(event.target.value);}
    if(action==="line-qty"){line.qty=normalizeQuantity(event.target.value)??1;}
    order.record.items=mergeLineItems(order.record.items);
  }
  void persistSavedOrderChanges(order.store,order.platform);
}

async function removeOrder(platform,uid){
  const store=normalizeStore(uiState.store||await readStore());
  const day=ensureDay(store,getDateKey());
  day.platforms[platform]=day.platforms[platform].filter((order)=>order.uid!==uid);
  await writeDay(getDateKey(),day);
  refreshDayViews();
  showMessage(`Removed order from ${platform}.`,"success");
}

async function persistSavedOrderChanges(store,platform){
  const day=ensureDay(store,getDateKey());
  day.platforms=normalizePlatforms(day.platforms);
  await writeDay(getDateKey(),day,{suppressMessage:true});
  refreshDayViews();
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
      item:item.sku?(catalogMap.get(sanitizeSku(item.sku))?.item??item.item??""):(item.item??""),
      srp:item.sku?(catalogMap.get(sanitizeSku(item.sku))?.srp??item.srp??null):(item.srp??null),
      qty:item.qty===""?"":(normalizeQuantity(item.qty)??1)
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
  const store=normalizeStore(uiState.store||{});
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
  const qtyField=row.querySelector('[data-action="draft-line-qty"]');
  const itemValue=line.item||"Type an item or choose from the catalog";
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
  if(qtyField&&document.activeElement!==qtyField){
    qtyField.value=line.qty===""?"":String(line.qty??1);
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
  return draft.items.some((item)=>isMeaningfulLineItem(item));
}

function getOrderLifecycleLabel(order){
  const status=normalizeOrderStatus(order.status);
  if(status==="cancelled"){return "Cancelled";}
  if(status==="returned"){return "Returned";}
  return isComplete(order)?"Completed":"Pending";
}

function isComplete(order){
  return normalizeOrderStatus(order.status)==="active"&&order.picture&&order.pickup;
}

function getLineItemTotal(item){
  const qty=normalizeQuantity(item?.qty);
  if(item.srp===null||qty===null){return null;}
  return Number((item.srp*qty).toFixed(2));
}

function getLineItemsTarget(items){
  const meaningful=items.filter(isMeaningfulLineItem);
  if(!meaningful.length){return null;}
  return meaningful.reduce((total,item)=>total+(getLineItemTotal(item)||0),0);
}

function getOrderSrpTotal(order){
  const override=normalizeMoney(order?.srpTotal);
  return override!==null?override:getLineItemsTarget(order?.items||[]);
}

function formatOrderSrpTotalInput(order){
  const value=getOrderSrpTotal(order);
  return value===null?"":value.toFixed(2);
}

function getProfitDifference(order){
  const orderTarget=getOrderSrpTotal(order);
  if(orderTarget===null||order.totalSales===null){return null;}
  return Number((order.totalSales-orderTarget).toFixed(2));
}

function getSalesOutcome(order){
  const status=normalizeOrderStatus(order.status);
  if(status==="cancelled"){return{label:"Cancelled",tone:"cancelled"};}
  if(status==="returned"){return{label:"Returned",tone:"returned"};}
  const profitDifference=getProfitDifference(order);
  if(profitDifference===null){return{label:"Pending sales",tone:"pending"};}
  if(profitDifference>0){return{label:`Win | +${formatMoney(profitDifference)}`,tone:"win"};}
  if(profitDifference<0){return{label:`Lose | -${formatMoney(Math.abs(profitDifference))}`,tone:"lose"};}
  return{label:"Break-even | 0.00",tone:"even"};
}

function normalizeMoney(value){
  if(value===""||value===null||value===undefined){return null;}
  const cleaned=typeof value==="string"?value.replace(/[₱,\s]/g,""):value;
  const amount=Number(cleaned);
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

function buildSummaryReasonLabel(order){
  const status=normalizeOrderStatus(order.status);
  if(status==="active"){return "-";}
  return order.reason||"-";
}

function formatMoney(value){
  if(value===null||value===undefined||!Number.isFinite(value)){return "0.00";}
  return Number(value).toFixed(2);
}

async function printSummary(){
  const summaryData=await getSummaryRenderData();
  if(!summaryData){return;}
  const printWindow=window.open("","","width=960,height=720");
  if(!printWindow){showMessage("The summary window was blocked. Please allow pop-ups and try again.","error");return;}
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Daily Orders Summary</title>
      <style>${getSummaryStyles()}</style>
    </head>
    <body>
      ${buildSummaryMarkup(summaryData)}
      <script>window.onload=()=>window.print()<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

async function downloadSummaryImage(){
  const summaryData=await getSummaryRenderData();
  if(!summaryData){return;}
  if(typeof window.html2canvas!=="function"){
    showMessage("Image export is not available right now. Reload the page and try again.","error");
    return;
  }

  const exportHost=document.createElement("div");
  exportHost.style.position="fixed";
  exportHost.style.left="-20000px";
  exportHost.style.top="0";
  exportHost.style.width="1400px";
  exportHost.style.padding="0";
  exportHost.style.margin="0";
  exportHost.style.background="#ffffff";
  exportHost.innerHTML=`
    <style>${getSummaryStyles()}</style>
    <div class="summary-export-root">
      ${buildSummaryMarkup(summaryData)}
    </div>
  `;
  document.body.appendChild(exportHost);

  try{
    showMessage("Generating summary image...","success");
    const canvas=await window.html2canvas(exportHost.querySelector(".summary-export-root"),{
      backgroundColor:"#ffffff",
      scale:2,
      useCORS:true
    });
    const link=document.createElement("a");
    link.href=canvas.toDataURL("image/png");
    link.download=`daily-orders-summary-${summaryData.dateKey}.png`;
    link.click();
    showMessage("Summary image downloaded.","success");
  }catch(error){
    console.error("Unable to export summary image:",error);
    showMessage("Could not generate the summary image.","error");
  }finally{
    exportHost.remove();
  }
}

async function getSummaryRenderData(){
  const dateKey=getDateKey();
  const store=normalizeStore(uiState.store&&Object.keys(uiState.store).length?uiState.store:await readStore());
  const day=store[dateKey];
  if(!dateKey||!day){showMessage("There is no saved data for this date yet.","error");return null;}
  const daySummary=buildDaySummary(day);
  const summarySections=platforms.map((platform)=>buildSummaryTable(platform,day.platforms[platform])).filter(Boolean).join("");
  if(!summarySections){showMessage("Add at least one order before printing the summary.","error");return null;}
  return{
    dateKey,
    preparedBy:day.approval.preparedBy,
    checkedBy:day.approval.checkedBy,
    daySummary,
    summarySections
  };
}

function buildSummaryMarkup(summaryData){
  return `
    <div class="summary-header">
      <div>
        <h1>Daily Orders Summary</h1>
        <p><strong>Date:</strong> ${escapeHtml(summaryData.dateKey)}</p>
        <p><strong>Prepared by:</strong> ${escapeHtml(summaryData.preparedBy)}</p>
        <p><strong>Checked by:</strong> ${escapeHtml(summaryData.checkedBy)}</p>
      </div>
      <img src="SOLARECO BLACK.png" alt="Solareco logo">
    </div>
    ${buildSummaryOverviewHtml(summaryData.daySummary)}
    ${buildCourierTotalsTable(summaryData.daySummary.courierTotals)}
    ${summaryData.summarySections}
  `;
}

function getSummaryStyles(){
  return `
    body{font-family:"Segoe UI",Arial,sans-serif;padding:16px;color:#142033;font-size:12px;background:#ffffff;}
    .summary-export-root{background:#ffffff;padding:16px;color:#142033;font-size:12px;}
    h1{margin:0 0 8px;font-size:22px;}
    h2{margin:0 0 8px;font-size:15px;}
    p{margin:0 0 4px;}
    .summary-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;}
    .summary-overview{display:grid;gap:10px;margin-bottom:14px;}
    .summary-group{display:grid;gap:8px;}
    .summary-group-title{margin:0;font-size:11px;font-weight:700;color:#5e6b82;text-transform:uppercase;letter-spacing:.08em;}
    .summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}
    .summary-grid.secondary{grid-template-columns:repeat(2,minmax(0,1fr));}
    .summary-card{padding:8px 10px;border:1px solid #d7deea;border-radius:8px;background:#f8fbff;}
    .summary-card.secondary{background:#ffffff;border-color:#e1e6ef;}
    .summary-card-label{margin:0 0 4px;font-size:10px;color:#5e6b82;text-transform:uppercase;letter-spacing:.08em;}
    .summary-card-value{margin:0;font-size:16px;font-weight:700;}
    .summary-card.secondary .summary-card-value{font-size:14px;}
    .courier-table{margin-bottom:16px;}
    .courier-table td:last-child,.courier-table th:last-child{text-align:right;}
    .table-total td{font-weight:700;background:#f8fbff;}
    img{max-width:140px;max-height:54px;object-fit:contain;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;}
    th,td{border:1px solid #d7deea;padding:6px 7px;text-align:left;vertical-align:top;font-size:11px;}
    th{background:#f4f7fb;font-size:10px;}
  `;
}

function buildSummaryTable(platform,orders){
  if(!orders||!orders.length){return "";}
  const totals=buildOrderCollectionSummary(orders);
  const rows=orders.map((order)=>`
    <tr>
      <td>${escapeHtml(order.id)}</td>
      <td>${escapeHtml(buildSummaryItemsLabel(order.items))}</td>
      <td>${formatMoney(getOrderSrpTotal(order))}</td>
      <td>${order.totalSales===null?"-":formatMoney(order.totalSales)}</td>
      <td>${escapeHtml(order.courier)}</td>
      <td>${order.picture?"Yes":"No"}</td>
      <td>${order.pickup?"Yes":"No"}</td>
      <td>${getOrderLifecycleLabel(order)}</td>
      <td>${escapeHtml(buildSummaryReasonLabel(order))}</td>
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
            <th>Reason</th>
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
            <td>${totals.completed} complete / ${totals.cancelled} cancelled / ${totals.returned} returned</td>
            <td>-</td>
            <td>${formatSignedMoney(totals.totalProfit)} profit / ${totals.notPickedUp} not picked up</td>
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
    totalProfit:0,
    pendingRequests:0,
    notPickedUp:0,
    pictureSent:0,
    pickedUp:0,
    completed:0,
    cancelled:0,
    returned:0,
    courierCounts:{}
  };
  orders.forEach((order)=>{
    summary.srpTotal+=getOrderSrpTotal(order)||0;
    summary.salesTotal+=order.totalSales||0;
    summary.totalProfit+=getProfitDifference(order)||0;
    if(hasPendingCancelRequest(order)){summary.pendingRequests+=1;}
    if(order.picture){summary.pictureSent+=1;}
    if(order.pickup){summary.pickedUp+=1;}
    else if(normalizeOrderStatus(order.status)==="active"){summary.notPickedUp+=1;}
    if(isComplete(order)){summary.completed+=1;}
    if(normalizeOrderStatus(order.status)==="cancelled"){summary.cancelled+=1;}
    if(normalizeOrderStatus(order.status)==="returned"){summary.returned+=1;}
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
    <section class="summary-overview">
      <div class="summary-group">
        <p class="summary-group-title">Today's Orders</p>
        <div class="summary-grid">
          <div class="summary-card">
            <p class="summary-card-label">Active Orders</p>
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
            <p class="summary-card-label">Active Profit</p>
            <p class="summary-card-value">${formatSignedMoney(summary.totalProfit)}</p>
          </div>
        </div>
      </div>
      <div class="summary-group">
        <p class="summary-group-title">Cancelled / Returned Records</p>
        <div class="summary-grid secondary">
          <div class="summary-card secondary">
            <p class="summary-card-label">Cancelled Orders</p>
            <p class="summary-card-value">${summary.cancelled}</p>
          </div>
          <div class="summary-card secondary">
            <p class="summary-card-label">Returned Orders</p>
            <p class="summary-card-value">${summary.returned}</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

function formatSignedMoney(value){
  if(value===null||value===undefined||!Number.isFinite(value)){return "0.00";}
  if(value>0){return `+${formatMoney(value)}`;}
  if(value<0){return `-${formatMoney(Math.abs(value))}`;}
  return "0.00";
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

function setSyncState({mode="checking",label="Checking sync",detail="",meta=""}={}){
  uiState.sync={mode,label,detail,meta};
  if(elements.syncBadge){
    elements.syncBadge.textContent=label;
    elements.syncBadge.className=`sync-badge ${mode}`;
  }
  if(elements.syncStatusText){
    elements.syncStatusText.textContent=detail;
  }
  if(elements.syncStatusMeta){
    elements.syncStatusMeta.textContent=meta;
  }
}

function buildSyncMeta(prefix,timestamp){
  return `${prefix} Last successful sync: ${formatTime(timestamp)}.`;
}

function formatTime(value){
  if(!(value instanceof Date)||Number.isNaN(value.getTime())){return "Unknown";}
  return value.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
}

function clearMessage(){showMessage("");}
