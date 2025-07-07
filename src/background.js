// background.js
// 只在 chatgpt.com 頁面啟用側邊欄，其他分頁自動隱藏

// 1. 定義 ChatGPT 的 origin
const CHATGPT_ORIGIN = "https://chatgpt.com";

/**
 * 根據 tabId 與 URL 更新該分頁的側邊欄狀態
 * @param {number} tabId   要操作的分頁 ID
 * @param {string?} url    該分頁的 URL（可能為 undefined）
 */
async function updateSidePanelForTab(tabId, url) {
  // 如果沒有 URL，直接隱藏
  if (!url) {
    await chrome.sidePanel.setOptions({ tabId, enabled: false });
    return;
  }

  // 只在 chatgpt.com 開啟
  const origin = new URL(url).origin;
  if (origin === CHATGPT_ORIGIN) {
    // 啟用並指定 path（只能用 tabId）
    await chrome.sidePanel.setOptions({
      tabId,
      path: "src/sidebar.html",
      enabled: true,
    });
  } else {
    // 隱藏：關閉此 tab 的側邊欄
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false,
    });
  }
}

// 2. 安裝或更新後，讓工具列按鈕可切換側邊欄
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// 3. 使用者點擊工具列按鈕時：先更新此 tab 的 enabled，再 open
chrome.action.onClicked.addListener(async ({ tab }) => {
  // 先依 URL 啟／隱側邊欄
  await updateSidePanelForTab(tab.id, tab.url);
  // 再用 tabId 開啟（global 開 windowId 會變成跨 tab）
  await chrome.sidePanel.open({ tabId: tab.id });
});

// 4. 分頁載入完成後：動態啟／隱側邊欄
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    updateSidePanelForTab(tabId, tab.url);
  }
});

// 5. 使用者切換分頁：也要即時更新側邊欄
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  updateSidePanelForTab(tabId, tab.url);
});
