// ----- 全域設定 -----
// 最大書籤顯示字數
const MAX_CONTENT_LENGTH = 30;
// 側邊欄排序、主題、語系儲存鍵
const SORT_KEY = "sidebar-sort-order";
const MOOD_KEY = "sidebar-mood";
const LANGUAGE_KEY = "sidebar-language";

// 圖示資源路徑
const MOON_ICON = "assets/icons/moon.svg";
const SUN_ICON = "assets/icons/sun.svg";
const HASHTAG_ICON = "assets/icons/hashtag.svg";

// 語系對應表
const LOCALE_MAP = { zh: "zh_TW", en: "en", ja: "ja" };

// 儲存讀取到的翻譯文字、目前聊天室 key、以及已選的 Hashtag
let messages = {};
let CURRENT_CHAT_KEY = null;
let selectedTags = new Set();

// ----- 路徑規格化 -----
// 把各種可能的 URL 轉成統一的格式
const normalizePath = (p) => {
  // 去掉尾斜線
  p = p.replace(/\/$/, "");
  // 如果是群組路徑 /g/.../c/<id>，只保留 /c/<id>
  const m = p.match(/^\/g\/[^/]+\/c\/([^/]+)$/);
  if (m) return `/c/${m[1]}`;
  // 首頁 / 新聊天室（沒有 chatId）
  if (p === "" || p === "/") return null;
  return p;
};

// ----- 等待主頁載入完成並初始化 -----
let chatReady = false;
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "chatgpt-ready") {
    chatReady = true;
    initCurrentKeyAndLoad();
  }
});

// ----- 主題切換功能 -----
// 讀取儲存的主題 預設 dark
function getSavedMood(callback) {
  chrome.storage.local.get([MOOD_KEY], (res) => {
    callback(res[MOOD_KEY] || "dark");
  });
}
// 根據 mood 參數套用頁面主題
function applyMood(mood) {
  document.body.classList.remove("light", "dark");
  if (mood === "system") {
    // 依系統動態監聽切換
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const actual = mq.matches ? "dark" : "light";
    document.body.classList.add(actual);
    mq.addEventListener("change", (e) => {
      document.body.classList.toggle("dark", e.matches);
      document.body.classList.toggle("light", !e.matches);
    });
  } else {
    // 明確指定 light / dark
    document.body.classList.add(mood);
  }
}
// 切換主題並儲存
function toggleMood() {
  getSavedMood((current) => {
    const next = current === "light" ? "dark" : "light";
    chrome.storage.local.set({ [MOOD_KEY]: next });
  });
}
// 監聽主題變動並立即套用新主題
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[MOOD_KEY]) {
    applyMood(changes[MOOD_KEY].newValue);
  }
});

// ----- 語言設定功能 -----
// 讀取指定語系的翻譯訊息
async function loadMessages(lang) {
  const loc = LOCALE_MAP[lang] || LOCALE_MAP.zh;
  const url = chrome.runtime.getURL(`_locales/${loc}/messages.json`);
  const res = await fetch(url);
  const json = await res.json();
  messages = Object.fromEntries(
    Object.entries(json).map(([k, v]) => [k, v.message])
  );
}
// 套用翻譯文字到 UI
function applyMessages() {
  document.getElementById("sidebar-title").textContent = messages.sidebarTitle;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = messages[key] || "";
  });
}
// 監聽外部語系變動
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[LANGUAGE_KEY]) {
    const newLang = changes[LANGUAGE_KEY].newValue;
    loadMessages(newLang).then(applyMessages);
  }
});

// ----- 標籤與書籤處理功能 -----
// 從 local+sync 取得目前聊天室所有書籤
function fetchBookmarksWithTags(cb) {
  if (!CURRENT_CHAT_KEY) return cb([]);
  dualGet(CURRENT_CHAT_KEY).then((list) => {
    const cleaned = list.map(withDefaults).filter((it) => !it.deleted);
    cb(cleaned);
  });
}

// 新增 Hashtag
function onAddTag(bookmarkId) {
  const tag = prompt(messages.addHashtagPrompt);
  if (!tag) return;
  dualRead(CURRENT_CHAT_KEY).then((list) => {
    const now = Date.now();
    const updated = list.map((it) => {
      if (it.id !== bookmarkId) return it;
      const hs = new Set(it.hashtags || []);
      hs.add(tag);
      return { ...withDefaults(it), hashtags: Array.from(hs), updatedAt: now };
    });
    dualSet(CURRENT_CHAT_KEY, updated).then(() => {
      renderHashtagList();
      loadSidebarBookmarks();
    });
  });
}
// 移除 Hashtag
function onRemoveTag(bookmarkId, tag) {
  dualRead(CURRENT_CHAT_KEY).then((list) => {
    const now = Date.now();
    const updated = list.map((it) => {
      if (it.id !== bookmarkId) return it;
      const hs = (it.hashtags || []).filter((t) => t !== tag);
      return { ...withDefaults(it), hashtags: hs, updatedAt: now };
    });
    dualSet(CURRENT_CHAT_KEY, updated).then(() => {
      renderHashtagList();
      loadSidebarBookmarks();
    });
  });
}

// Hashtag 篩選按鈕
function renderHashtagList() {
  fetchBookmarksWithTags((list) => {
    const all = list.flatMap((item) => item.hashtags);
    const uniq = Array.from(new Set(all));
    // 清除不存在的已選標籤
    selectedTags.forEach((tag) => {
      if (!uniq.includes(tag)) selectedTags.delete(tag);
    });
    const container = document.getElementById("hashtag-container");
    container.innerHTML = "";
    uniq.forEach((tag) => {
      const span = document.createElement("div");
      span.className = "hashtag-item";
      span.textContent = `# ${tag}`;
      if (selectedTags.has(tag)) span.classList.add("selected");
      span.addEventListener("click", () => {
        if (selectedTags.has(tag)) selectedTags.delete(tag);
        else selectedTags.add(tag);
        renderHashtagList();
        loadSidebarBookmarks();
      });
      container.appendChild(span);
    });
  });
}

// ----- 排序功能 -----
// 讀取排序方式
function getSavedSort() {
  return localStorage.getItem(SORT_KEY) || "added";
}
// 儲存排序方式
function saveSort(sort) {
  localStorage.setItem(SORT_KEY, sort);
}

// ----- 載入與排序書籤 -----
function loadSidebarBookmarks() {
  if (!CURRENT_CHAT_KEY) return;
  fetchBookmarksWithTags((list) => {
    // 標籤篩選
    if (selectedTags.size) {
      list = list.filter((item) =>
        (item.hashtags || []).some((tag) => selectedTags.has(tag))
      );
    }

    // 排序
    const sortOrder = getSavedSort();
    if (sortOrder === "chat") {
      // 依聊天順序（DOM 出現順序）
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) return renderList(list);
        const origin = new URL(tabs[0].url || "").origin;
        if (
          !["https://chat.openai.com", "https://chatgpt.com"].includes(origin)
        ) {
          renderList(list);
          return;
        }
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: "getChatOrder" },
          (response) => {
            if (chrome.runtime.lastError) {
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
      // 依加入順序（穩定使用 createdAt；舊資料回退 updatedAt）
      list.sort((a, b) => {
        const ta = a.createdAt || a.updatedAt || 0;
        const tb = b.createdAt || b.updatedAt || 0;
        return ta - tb;
      });
      renderList(list);
    }
  });
}

// ----- 清理 sidebar -----
function clearSidebar() {
  const list = document.getElementById("bookmark-list");
  if (list) list.innerHTML = "";
  const tagBox = document.getElementById("hashtag-container");
  if (tagBox) tagBox.innerHTML = "";
  selectedTags.clear();
}

// ----- 顯示書籤列表 -----
function renderList(list) {
  const container = document.getElementById("bookmark-list");
  container.innerHTML = "";
  list.forEach((item) => {
    // 超過 MAX_CONTENT_LENGTH 就截斷
    const fullText = item.content || "";
    const displayText =
      fullText.length > MAX_CONTENT_LENGTH
        ? fullText.slice(0, MAX_CONTENT_LENGTH) + "  . . ."
        : fullText;
    const div = document.createElement("div");
    div.className = "bookmark";
    div.textContent = displayText;
    div.title = messages.scrollToMessageTooltip;
    div.style.cursor = "pointer";
    div.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "scrollToMessage",
          id: item.id,
        });
      });
    });
    // 如果有 tags 顯示在書籤下方
    if (item.hashtags.length) {
      const tagLine = document.createElement("div");
      tagLine.className = "tags-list";
      item.hashtags.forEach((tag) => {
        const span = document.createElement("span");
        span.className = "tag-item";
        span.textContent = `# ${tag}`;
        const btn = document.createElement("button");
        btn.className = "remove-tag-btn";
        btn.textContent = "×";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          onRemoveTag(item.id, tag);
        });
        span.appendChild(btn);
        tagLine.appendChild(span);
      });
      div.appendChild(tagLine);
    }
    // 新增標籤按鈕
    const btnTag = document.createElement("button");
    btnTag.className = "tag-btn";
    const icon = document.createElement("img");
    icon.className = "tag-icon";
    icon.src = chrome.runtime.getURL(HASHTAG_ICON);
    btnTag.appendChild(icon);
    btnTag.addEventListener("click", () => onAddTag(item.id));
    div.appendChild(btnTag);

    container.appendChild(div);
  });
}

// ----- 初始化 & 監聽路由變化 -----
let BOUND_KEY = null;

function initCurrentKeyAndLoad() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.url) return;
    const path = normalizePath(new URL(tabs[0].url).pathname);
    if (!path) {
      if (CURRENT_CHAT_KEY !== null) {
        CURRENT_CHAT_KEY = null;
        clearSidebar();
      }
      return;
    }

    if (path !== CURRENT_CHAT_KEY) {
      CURRENT_CHAT_KEY = path;

      // 綁定對應 key 的 storage 監聽（避免重複綁）
      if (BOUND_KEY !== CURRENT_CHAT_KEY) {
        BOUND_KEY = CURRENT_CHAT_KEY;
        onKeyStorageChanged(CURRENT_CHAT_KEY, () => {
          renderHashtagList();
          loadSidebarBookmarks();
        });
      }

      renderHashtagList();
      loadSidebarBookmarks();
    }
  });
}

// 頁面載入後執行一次初始化，並每＿秒檢查路徑與空白狀態
document.addEventListener("DOMContentLoaded", async () => {
  // 載入語系與套用文字
  const { [LANGUAGE_KEY]: storedLang } = await chrome.storage.local.get(
    LANGUAGE_KEY
  );
  const lang = storedLang || "zh";
  await loadMessages(lang);
  applyMessages();

  // 初始化書籤
  initCurrentKeyAndLoad();
  setInterval(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url;
      if (!url) return;

      const path = normalizePath(new URL(url).pathname);
      const listEmpty =
        !document.getElementById("bookmark-list").childElementCount;

      // (A) 新聊天室：沒有 chatId → 直接清空
      if (!path) {
        if (CURRENT_CHAT_KEY !== null || !listEmpty) {
          CURRENT_CHAT_KEY = null;
          BOUND_KEY = null;
          clearSidebar();
        }
        return;
      }

      // (B) 有 chatId：切換聊天室或畫面是空的 → 載入
      if (path !== CURRENT_CHAT_KEY || listEmpty) {
        CURRENT_CHAT_KEY = path;
        if (BOUND_KEY !== CURRENT_CHAT_KEY) {
          BOUND_KEY = CURRENT_CHAT_KEY;
          onKeyStorageChanged(CURRENT_CHAT_KEY, () => {
            renderHashtagList();
            loadSidebarBookmarks();
          });
        }
        renderHashtagList();
        loadSidebarBookmarks();
      }
    });
  }, 500);

  // 綁定按鈕：設定頁、排序切換、主題讀取
  document
    .getElementById("settings-button")
    .addEventListener("click", () => chrome.runtime.openOptionsPage());
  const sortSelect = document.getElementById("sort-order");
  sortSelect.value = getSavedSort();
  sortSelect.addEventListener("change", () => {
    saveSort(sortSelect.value);
    loadSidebarBookmarks();
  });
  chrome.storage.local.get(MOOD_KEY, (res) =>
    applyMood(res[MOOD_KEY] || "system")
  );
});

// ----- 滾動按鈕功能 -----
document.getElementById("scroll-top-btn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: "scroll-to-top" });
  });
});
document.getElementById("scroll-bottom-btn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: "scroll-to-bottom" });
  });
});
