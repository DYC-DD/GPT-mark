// 1. 定義網站的 origin
const CHATGPT_ORIGIN = "https://chatgpt.com";

// 根據 tabId 與 URL 更新該分頁的側邊欄狀態
async function updateSidePanelForTab(tabId, url) {
  if (!url) {
    await chrome.sidePanel.setOptions({ tabId, enabled: false });
    return;
  }

  // 只在 chatgpt.com 開啟
  const origin = new URL(url).origin;
  if (origin === CHATGPT_ORIGIN) {
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

// 2. 安裝或更新 讓工具列按鈕可切換側邊欄
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// 3. 點擊工具列按鈕時 先更新啟用狀態再在允許網域下開啟側邊欄
chrome.action.onClicked.addListener(async (tab) => {
  await updateSidePanelForTab(tab.id, tab.url);
  try {
    const origin = new URL(tab.url || "").origin;
    if (origin === CHATGPT_ORIGIN) {
      // 僅在允許的網域下才真正呼叫 open
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  } catch (e) {
    console.warn("[ChatGPT Bookmark] 無法開啟側邊欄：", e);
  }
});

// 4. 分頁載入完成後：動態啟／隱側邊欄
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    updateSidePanelForTab(tabId, tab.url);
  }
});

// 5. 使用者切換分頁：即時更新側邊欄
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  updateSidePanelForTab(tabId, tab.url);
});
