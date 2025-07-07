// ===== 全域變數：存放目前要顯示的聊天室 key =====
let CURRENT_CHAT_KEY = null;

/**
 * 取得當前分頁 URL，並取出 pathname 作為聊天室 key
 *    然後載入此聊天室的書籤
 */
function initCurrentKeyAndLoad() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return;
    const url = new URL(tabs[0].url);
    const newKey = url.pathname; // 例如 "/chat/ABC123"

    // 如果發現 key 變了，更新並重新載入書籤
    if (newKey !== CURRENT_CHAT_KEY) {
      CURRENT_CHAT_KEY = newKey;
      loadSidebarBookmarks();
    }
  });
}

/**
 * 從 chrome.storage.local 讀取「當前聊天室」的書籤清單
 *    並渲染到側邊欄上
 */
function loadSidebarBookmarks() {
  if (!CURRENT_CHAT_KEY) return;

  chrome.storage.local.get([CURRENT_CHAT_KEY], (result) => {
    const list = result[CURRENT_CHAT_KEY] || [];
    const container = document.getElementById("bookmark-list");
    container.innerHTML = ""; // 先清空

    list.forEach((item) => {
      const div = document.createElement("div");
      div.className = "bookmark";
      div.textContent = item.content; // 顯示書籤文字
      container.appendChild(div);
    });
  });
}

/**
 * 監聽 storage 變動：當 Content Script 加／刪書籤時，
 *    如果該 key 與 CURRENT_CHAT_KEY 相同，就立即更新畫面
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !CURRENT_CHAT_KEY) return;
  if (changes[CURRENT_CHAT_KEY]) {
    loadSidebarBookmarks();
  }
});

/**
 * DOMContentLoaded 時先做一次初始化，
 *    以及啟動定時器，每秒檢查一次分頁 URL（是否切換聊天室）
 */
document.addEventListener("DOMContentLoaded", () => {
  // 馬上執行一次
  initCurrentKeyAndLoad();

  // 每秒檢查一次 active tab URL
  setInterval(initCurrentKeyAndLoad, 1000);
});
