const ALLOWED_ORIGINS = ["https://chat.openai.com", "https://chatgpt.com"];

// ----- 根據當前分頁啟用或停用側邊欄 -----
async function updateSidePanelForTab(tabId, url) {
  if (!url) {
    await chrome.sidePanel.setOptions({ tabId, enabled: false });
    return;
  }

  const origin = new URL(url).origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: "src/sidebar/sidebar.html",
      enabled: true,
    });
  } else {
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false,
    });
  }
}

// ----- 分頁的狀態或網址變動時更新側邊欄狀態 -----
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    return updateSidePanelForTab(tabId, changeInfo.url);
  }
  if (changeInfo.status === "complete" && tab.url) {
    return updateSidePanelForTab(tabId, tab.url);
  }
});

// ----- 擴充功能安裝/更新時：設定側邊欄點擊行為與右鍵選單 -----
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.contextMenus.create({
    id: "open-sidebar",
    title: "Open GPT-mark",
    contexts: ["page", "action"],
    documentUrlPatterns: ["https://chat.openai.com/*", "https://chatgpt.com/*"],
  });
});

// ----- 點擊擴充功能圖示開啟側邊欄 -----
chrome.action.onClicked.addListener(async (tab) => {
  await updateSidePanelForTab(tab.id, tab.url);
  try {
    const origin = new URL(tab.url || "").origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  } catch (e) {
    console.warn("[ChatGPT Bookmark] 無法開啟側邊欄：", e);
  }
});

// ----- 點右鍵選單開啟側邊欄 -----
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "open-sidebar" || !tab?.id || !tab.url) return;
  const origin = new URL(tab.url).origin;
  if (!ALLOWED_ORIGINS.includes(origin)) return;
  chrome.sidePanel.setOptions(
    {
      tabId: tab.id,
      path: "src/sidebar/sidebar.html",
      enabled: true,
    },
    () => {
      chrome.sidePanel.open({ tabId: tab.id });
    }
  );
});

// ----- 切換分頁根據新分頁網址更新側邊欄啟用狀態 -----
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  updateSidePanelForTab(tabId, tab.url);
});
