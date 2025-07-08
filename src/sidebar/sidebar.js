const MAX_CONTENT_LENGTH = 30; // 書籤最大顯示字數
const SORT_KEY = "sidebar-sort-order";
const MOOD_KEY = "sidebar-mood";
const MOON_ICON = "assets/icons/moon.svg";
const SUN_ICON = "assets/icons/sun.svg";

let CURRENT_CHAT_KEY = null;

// ----- 排序功能 -----
function getSavedSort() {
  return localStorage.getItem(SORT_KEY) || "added";
}
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
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) return;

        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: "getChatOrder" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "[ChatGPT Bookmark] 無法取得聊天順序：",
                chrome.runtime.lastError.message
              );
              renderList(list);
              return;
            }

            const order = response?.order || [];
            list.sort((a, b) => {
              const ia = order.indexOf(a.id);
              const ib = order.indexOf(b.id);
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

// ----- 聊天室切換 & 監聽 -----
/** 取得並設定當前聊天室 key 若有變動就重新載入書籤 */
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

// ----- 主題切換功能 -----
/** 讀取儲存的主題 */
function getSavedMood() {
  return localStorage.getItem(MOOD_KEY) || "dark";
}

/** 套用主題 */
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

// ----- 初始化 -----
document.addEventListener("DOMContentLoaded", () => {
  applyMood(getSavedMood());
  document.getElementById("mood-toggle").addEventListener("click", toggleMood);

  const sortSelect = document.getElementById("sort-order");
  if (sortSelect) {
    sortSelect.value = getSavedSort();
    sortSelect.addEventListener("change", () => {
      saveSort(sortSelect.value);
      loadSidebarBookmarks();
    });
  }

  initCurrentKeyAndLoad();
  setInterval(initCurrentKeyAndLoad, 1000);
});
