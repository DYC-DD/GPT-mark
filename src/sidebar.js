/**
 * src/sidebar.js
 *
 * 側邊欄書籤顯示邏輯，新增固定字數截斷
 */

// ------------ 常數設定 ------------

// 每則書籤顯示的最大字數，超過後加上「...」
const MAX_CONTENT_LENGTH = 30;

// 目前要使用的聊天室 key（從 URL pathname 取）
let CURRENT_CHAT_KEY = null;

/**
 * 1️⃣ 取得並設定當前聊天室 key，若有變動就重新載入書籤
 */
function initCurrentKeyAndLoad() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return;
    const pathname = new URL(tabs[0].url).pathname;
    // 如果 key 不同，更新並載入書籤
    if (pathname !== CURRENT_CHAT_KEY) {
      CURRENT_CHAT_KEY = pathname;
      loadSidebarBookmarks();
    }
  });
}

/**
 * 2️⃣ 從 chrome.storage.local 讀取「當前聊天室」書籤清單，
 *    並依照 MAX_CONTENT_LENGTH 截斷內容後渲染到側邊欄
 */
function loadSidebarBookmarks() {
  if (!CURRENT_CHAT_KEY) return;
  chrome.storage.local.get([CURRENT_CHAT_KEY], (res) => {
    const list = res[CURRENT_CHAT_KEY] || [];
    const container = document.getElementById("bookmark-list");
    container.innerHTML = ""; // 清空舊內容

    list.forEach((item) => {
      // 原始完整文字
      const fullText = item.content || "";
      // 判斷是否需要截斷
      const displayText =
        fullText.length > MAX_CONTENT_LENGTH
          ? fullText.substring(0, MAX_CONTENT_LENGTH) + "  . . . . . ."
          : fullText;

      // 建立 div 顯示截斷後文字
      const div = document.createElement("div");
      div.className = "bookmark";
      div.textContent = displayText;
      container.appendChild(div);
    });
  });
}

/**
 * 3️⃣ 監聽 storage 變動：當 Content Script 更新書籤時，
 *    若變動的 key 正好是 CURRENT_CHAT_KEY，就重新載入
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !CURRENT_CHAT_KEY) return;
  if (changes[CURRENT_CHAT_KEY]) {
    loadSidebarBookmarks();
  }
});

/* ------------------- mood 切換 ------------------- */

const MOON_ICON = "assets/icons/moon.svg";
const SUN_ICON = "assets/icons/sun.svg";

// 取得儲存的 mood，預設 light
function getSavedMood() {
  return localStorage.getItem("sidebar-mood") || "light";
}

// 套用 mood：切換 body class、更新 icon src
function applyMood(mood) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(mood);
  const img = document.getElementById("mood-icon");
  const file = mood === "light" ? MOON_ICON : SUN_ICON;
  img.src = chrome.runtime.getURL(file);
}

// 切換 mood 並儲存
function toggleMood() {
  const next = getSavedMood() === "light" ? "dark" : "light";
  localStorage.setItem("sidebar-mood", next);
  applyMood(next);
}

/* ------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  // 1. 初始化並套用上次的主題
  applyMood(getSavedMood());
  // 2. 綁定按鈕
  document.getElementById("mood-toggle").addEventListener("click", toggleMood);
  // 3. 初始化書籤載入及監控
  initCurrentKeyAndLoad();
  setInterval(initCurrentKeyAndLoad, 1000);
});
