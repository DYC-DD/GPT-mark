/**
 * src/sidebar.js
 *
 * 側邊欄書籤顯示邏輯：
 * - 固定字數截斷
 * - 排序選單（依加入順序 / 依聊天順序）
 * - 主題切換（light / dark）
 */

// ------------ 常數設定 ------------

const MAX_CONTENT_LENGTH = 30; // 每則書籤最大顯示字數
const SORT_KEY = "sidebar-sort-order"; // 排序方式存 localStorage 的 key
const MOOD_KEY = "sidebar-mood"; // 主題模式存 localStorage 的 key
const MOON_ICON = "assets/icons/moon.svg";
const SUN_ICON = "assets/icons/sun.svg";

let CURRENT_CHAT_KEY = null; // 當前聊天室 key（pathname）

// ------------ 排序功能 ------------

/** 讀取儲存的排序方式，預設 'added' （依加入順序） */
function getSavedSort() {
  return localStorage.getItem(SORT_KEY) || "added";
}
/** 儲存排序方式 */
function saveSort(sort) {
  localStorage.setItem(SORT_KEY, sort);
}

/** 根據排序方式載入並渲染書籤 */
function loadSidebarBookmarks() {
  if (!CURRENT_CHAT_KEY) return;
  chrome.storage.local.get([CURRENT_CHAT_KEY], (res) => {
    let list = res[CURRENT_CHAT_KEY] || [];

    const sortOrder = getSavedSort();
    if (sortOrder === "chat") {
      // 依聊天順序：向 content script 要 chat order
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) return;
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: "getChatOrder" },
          (response) => {
            const order = response?.order || [];
            list.sort((a, b) => {
              const ia = order.indexOf(a.id),
                ib = order.indexOf(b.id);
              return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
            });
            renderList(list);
          }
        );
      });
    } else {
      // 依加入順序
      renderList(list);
    }
  });
}

/** 真正把排序後的 list 渲染到 DOM */
function renderList(list) {
  const container = document.getElementById("bookmark-list");
  container.innerHTML = "";

  list.forEach((item) => {
    const fullText = item.content || "";
    const displayText =
      fullText.length > MAX_CONTENT_LENGTH
        ? fullText.slice(0, MAX_CONTENT_LENGTH) + "  . . ."
        : fullText;

    const div = document.createElement("div");
    div.className = "bookmark";
    div.textContent = displayText;
    div.style.cursor = "pointer";
    div.title = "點擊跳到該訊息";

    // 點擊後發送 scroll 訊息給 content script
    div.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) return;
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "scrollToMessage",
          id: item.id,
        });
      });
    });

    container.appendChild(div);
  });
}

// ------------ 聊天室切換 & 監聽 ------------

/** 取得並設定當前聊天室 key，若有變動就重新載入書籤 */
function initCurrentKeyAndLoad() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.url) return;
    const pathname = new URL(tabs[0].url).pathname;
    if (pathname !== CURRENT_CHAT_KEY) {
      CURRENT_CHAT_KEY = pathname;
      loadSidebarBookmarks();
    }
  });
}

/** 監聽 storage 變動：若當前聊天室的書籤變動，就重新載入 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && CURRENT_CHAT_KEY in changes) {
    loadSidebarBookmarks();
  }
});

// ------------ 主題切換功能 ------------

/** 讀取儲存的主題，預設 light */
function getSavedMood() {
  return localStorage.getItem(MOOD_KEY) || "light";
}

/** 套用主題：切換 body class 並更新 icon */
function applyMood(mood) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(mood);
  const img = document.getElementById("mood-icon");
  const file = mood === "light" ? MOON_ICON : SUN_ICON;
  img.src = chrome.runtime.getURL(file);
}

/** 切換主題並儲存 */
function toggleMood() {
  const next = getSavedMood() === "light" ? "dark" : "light";
  localStorage.setItem(MOOD_KEY, next);
  applyMood(next);
}

// ------------ 初始化 ------------

document.addEventListener("DOMContentLoaded", () => {
  // 1. 套用上次選擇的主題，並綁定按鈕
  applyMood(getSavedMood());
  document.getElementById("mood-toggle").addEventListener("click", toggleMood);

  // 2. 初始化排序下拉選單
  const sortSelect = document.getElementById("sort-order");
  if (sortSelect) {
    sortSelect.value = getSavedSort();
    sortSelect.addEventListener("change", () => {
      saveSort(sortSelect.value);
      loadSidebarBookmarks();
    });
  }

  // 3. 初始化聊天室 key 檢查並定時輪詢
  initCurrentKeyAndLoad();
  setInterval(initCurrentKeyAndLoad, 1000);
});
