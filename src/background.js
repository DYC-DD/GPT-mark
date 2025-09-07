const ALLOWED_ORIGINS = ["https://chat.openai.com", "https://chatgpt.com"];
const MENU_PAGE = "open-sidebar-page";
const MENU_ACTION = "open-sidebar-action";

// 判斷是否允許的網域
function isAllowed(url = "") {
  try {
    return ALLOWED_ORIGINS.includes(new URL(url).origin);
  } catch {
    return false;
  }
}

// 依分頁網址啟用/停用側欄
async function updateSidePanelForTab(tabId, url) {
  if (!tabId || !url) {
    try {
      await chrome.sidePanel.setOptions({ tabId, enabled: false });
    } catch {}
    return;
  }
  if (isAllowed(url)) {
    try {
      await chrome.sidePanel.setOptions({
        tabId,
        path: "src/sidebar/sidebar.html",
        enabled: true,
      });
    } catch {}
  } else {
    try {
      await chrome.sidePanel.setOptions({ tabId, enabled: false });
    } catch {}
  }
  // 無論允許與否，都清空 popup，避免在該分頁點圖示彈出設定視窗
  await clearActionPopup(tabId);
}

// 以「最可靠的方式」在指定分頁開側欄（callback 以避免競態）
function openSidePanelWithSetOptions(tabId) {
  // 直接重新指定一次，並在 callback 內 open
  chrome.sidePanel.setOptions(
    { tabId, path: "src/sidebar/sidebar.html", enabled: true },
    () => chrome.sidePanel.open({ tabId }).catch(() => {})
  );
}

// 初始化：點工具列圖示 → 嘗試開側欄（是否能開由各 tab 的 enabled 決定）
async function initPanelBehavior() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {}
}

// 建立右鍵選單
async function recreateContextMenus() {
  try {
    await chrome.contextMenus.removeAll();
  } catch {}
  try {
    // 1) 頁面右鍵：只在允許網域顯示
    chrome.contextMenus.create({
      id: MENU_PAGE,
      title: "Open GPT-mark",
      contexts: ["page"],
      documentUrlPatterns: [
        "https://chat.openai.com/*",
        "https://chatgpt.com/*",
      ],
    });
    // 2) 擴充圖示右鍵：各網域都顯示，但點擊時再判斷是否允許
    chrome.contextMenus.create({
      id: MENU_ACTION,
      title: "Open GPT-mark",
      contexts: ["action"],
    });
  } catch {}
}

// 右鍵選單點擊 → 嘗試開側欄（只在允許網域動作）
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_PAGE && info.menuItemId !== MENU_ACTION) return;

  // 可靠取得目前分頁
  let target = tab;
  if (!target || !target.id || !target.url) {
    const [active] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    target = active;
  }
  if (!target?.id || !isAllowed(target.url)) return;

  // 用 callback 版避免 setOptions/open 的競態
  openSidePanelWithSetOptions(target.id);
});

// --- lifecycle wiring ---
chrome.runtime.onInstalled.addListener(async () => {
  await initPanelBehavior();
  await chrome.sidePanel.setOptions({ enabled: false }).catch(() => {});
  await recreateContextMenus();
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((t) => updateSidePanelForTab(t.id, t.url || "")));
});

chrome.runtime.onStartup.addListener(async () => {
  await initPanelBehavior();
  await chrome.sidePanel.setOptions({ enabled: false }).catch(() => {});
  await recreateContextMenus();
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((t) => updateSidePanelForTab(t.id, t.url || "")));
});

// 分頁網址變更 → 更新 gating
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateSidePanelForTab(tabId, changeInfo.url);
  } else if (changeInfo.status === "complete" && tab?.url) {
    updateSidePanelForTab(tabId, tab.url);
  }
});

// 切換分頁 → 更新 gating
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  updateSidePanelForTab(tabId, tab.url || "");
});

// 視窗焦點改變 → 同步當前分頁狀態
chrome.windows.onFocusChanged.addListener(async () => {
  const [active] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (active?.id) updateSidePanelForTab(active.id, active.url || "");
});

// --- 新增：清空當前分頁的 action popup 綁定 ---
async function clearActionPopup(tabId) {
  try {
    if (tabId) await chrome.action.setPopup({ tabId, popup: "" });
  } catch {}
}

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === "CLEAR_ACTION_POPUP_FOR_ACTIVE_TAB") {
    const [active] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (active?.id) {
      try {
        await chrome.action.setPopup({ tabId: active.id, popup: "" });
      } catch {}
    }
  }
});
