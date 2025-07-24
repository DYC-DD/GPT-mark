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

// 儲存翻譯文字、當前聊天室路徑及選取的標籤集合
let messages = {};
let CURRENT_CHAT_KEY = null;
let selectedTags = new Set();

// ChatGPT 主頁就緒旗標
let chatReady = false;
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "chatgpt-ready") {
    chatReady = true;
    loadSidebarBookmarks();
  }
});

// ----- 主題切換功能 -----
// 從 storage 讀取並回傳當前主題
function getSavedMood(callback) {
  chrome.storage.local.get([MOOD_KEY], (res) => {
    callback(res[MOOD_KEY] || "dark");
  });
}
// 套用主題樣式到 body
function applyMood(mood) {
  document.body.classList.remove("light", "dark");
  if (mood === "system") {
    // 依系統深淺設定
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const actual = mq.matches ? "dark" : "light";
    document.body.classList.add(actual);
    // 動態監聽系統切換
    mq.addEventListener("change", (e) => {
      document.body.classList.toggle("dark", e.matches);
      document.body.classList.toggle("light", !e.matches);
    });
  } else {
    // 明確選 dark 或 light
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
// 監聽主題變動，立即套用新主題
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
// 從 storage 中讀取帶標籤的書籤列表
function fetchBookmarksWithTags(cb) {
  chrome.storage.local.get([CURRENT_CHAT_KEY], (res) => {
    const list = res[CURRENT_CHAT_KEY] || [];
    cb(list.map((item) => ({ ...item, hashtags: item.hashtags || [] })));
  });
}

// 新增 Hashtag
function onAddTag(bookmarkId) {
  const tag = prompt(messages.addHashtagPrompt);
  if (!tag) return;
  fetchBookmarksWithTags((list) => {
    const updated = list.map((item) => {
      if (item.id === bookmarkId) {
        const hs = new Set(item.hashtags);
        hs.add(tag);
        return { ...item, hashtags: Array.from(hs) };
      }
      return item;
    });
    chrome.storage.local.set({ [CURRENT_CHAT_KEY]: updated }, () => {
      renderHashtagList();
      loadSidebarBookmarks();
    });
  });
}

// 移除 Hashtag
function onRemoveTag(bookmarkId, tag) {
  fetchBookmarksWithTags((list) => {
    const updated = list.map((item) => {
      if (item.id === bookmarkId) {
        const newTags = item.hashtags.filter((t) => t !== tag);
        return { ...item, hashtags: newTags };
      }
      return item;
    });
    chrome.storage.local.set({ [CURRENT_CHAT_KEY]: updated }, () => {
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
        item.hashtags.some((tag) => selectedTags.has(tag))
      );
    }

    const sortOrder = getSavedSort();
    if (sortOrder === "chat") {
      // 依聊天順序
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) return;
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
      // 依加入順序
      renderList(list);
    }
  });
}

// ----- 顯示書籤列表 -----
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

    // 已有標籤顯示
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

// ----- 側邊欄初始化與監聽 -----
// 設定當前聊天室 key 並載入
function initCurrentKeyAndLoad() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.url) return;
    const pathname = new URL(tabs[0].url).pathname;
    if (pathname !== CURRENT_CHAT_KEY) {
      CURRENT_CHAT_KEY = pathname;
      renderHashtagList();
      loadSidebarBookmarks();
    }
  });
}

// 監聽 storage 變動
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && CURRENT_CHAT_KEY in changes) {
    renderHashtagList();
    loadSidebarBookmarks();
  }
});

// DOMContentLoaded 初始化
document.addEventListener("DOMContentLoaded", async () => {
  // 載入語系與套用文字
  const savedLang = localStorage.getItem(LANGUAGE_KEY) || "zh";
  await loadMessages(savedLang);
  applyMessages();

  // 初始化 key 與側邊欄
  initCurrentKeyAndLoad();
  setInterval(initCurrentKeyAndLoad, 1000);
  loadSidebarBookmarks();

  // 綁定設定、排序與主題切換
  document
    .getElementById("settings-button")
    .addEventListener("click", () => chrome.runtime.openOptionsPage());
  const sortSelect = document.getElementById("sort-order");
  sortSelect.value = getSavedSort();
  sortSelect.addEventListener("change", () => {
    saveSort(sortSelect.value);
    loadSidebarBookmarks();
  });
  // 讀取並套用初始主題
  chrome.storage.local.get(MOOD_KEY, (res) =>
    applyMood(res[MOOD_KEY] || "dark")
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
