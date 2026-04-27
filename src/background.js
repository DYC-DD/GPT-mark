importScripts("/src/shared/constants.js");

const { CHATGPT_MATCH_PATTERNS, MESSAGE_TYPES, PATHS, isAllowedChatOrigin } =
  self.GPT_MARK;
const MENU_PAGE = "open-sidebar-page";
const MENU_ACTION = "open-sidebar-action";

// 依 tab URL 切換 side panel 啟用狀態
async function updateSidePanelForTab(tabId, url) {
  if (!tabId || !url) {
    try {
      await chrome.sidePanel.setOptions({ tabId, enabled: false });
    } catch {}
    return;
  }
  if (isAllowedChatOrigin(url)) {
    try {
      await chrome.sidePanel.setOptions({
        tabId,
        path: PATHS.SIDEBAR_PAGE,
        enabled: true,
      });
    } catch {}
  } else {
    try {
      await chrome.sidePanel.setOptions({ tabId, enabled: false });
    } catch {}
  }
  // 清除 action popup，避免 toolbar click 開啟設定 popup
  await clearActionPopup(tabId);
}

// 先設定 side panel 再開啟，避免 setOptions/open race condition
function openSidePanelWithSetOptions(tabId) {
  // 在 callback 中 open，確保本次設定已生效
  chrome.sidePanel.setOptions(
    { tabId, path: PATHS.SIDEBAR_PAGE, enabled: true },
    () => chrome.sidePanel.open({ tabId }).catch(() => {})
  );
}

// 啟用 toolbar icon 直接開啟 side panel 的預設行為
async function initPanelBehavior() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {}
}

// ===== Context menu 右鍵選單 =====
async function recreateContextMenus() {
  try {
    await chrome.contextMenus.removeAll();
  } catch {}
  try {
    // 頁面右鍵：僅在 ChatGPT 網域顯示
    chrome.contextMenus.create({
      id: MENU_PAGE,
      title: "Open GPT-mark",
      contexts: ["page"],
      documentUrlPatterns: CHATGPT_MATCH_PATTERNS,
    });
    // extension icon 右鍵：全域顯示，點擊時再驗證 tab URL
    chrome.contextMenus.create({
      id: MENU_ACTION,
      title: "Open GPT-mark",
      contexts: ["action"],
    });
  } catch {}
}

// Context menu 點擊後只在允許網域開啟 side panel
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_PAGE && info.menuItemId !== MENU_ACTION) return;

  // contextMenus 有時不帶 tab，必要時改查 active tab
  let target = tab;
  if (!target || !target.id || !target.url) {
    const [active] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    target = active;
  }
  if (!target?.id || !isAllowedChatOrigin(target.url)) return;

  // 先 setOptions 再 open，避免 side panel 尚未啟用
  openSidePanelWithSetOptions(target.id);
});

// ===== Extension lifecycle 生命週期 =====
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

// tab URL 或載入狀態改變時更新 side panel 啟用條件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateSidePanelForTab(tabId, changeInfo.url);
  } else if (changeInfo.status === "complete" && tab?.url) {
    updateSidePanelForTab(tabId, tab.url);
  }
});

// active tab 變更時同步 side panel 啟用條件
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  updateSidePanelForTab(tabId, tab.url || "");
});

// 視窗重新取得焦點時同步 active tab 狀態
chrome.windows.onFocusChanged.addListener(async () => {
  const [active] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (active?.id) updateSidePanelForTab(active.id, active.url || "");
});

// ===== Action popup 清理 =====
async function clearActionPopup(tabId) {
  try {
    if (tabId) await chrome.action.setPopup({ tabId, popup: "" });
  } catch {}
}

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === MESSAGE_TYPES.CLEAR_ACTION_POPUP_FOR_ACTIVE_TAB) {
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
