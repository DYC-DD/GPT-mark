// ----- 全域設定 -----
const MAX_CONTENT_LENGTH = 30; // 書籤最大顯示字數
const SORT_KEY = "sidebar-sort-order"; // 排序方式儲存鍵
const MOOD_KEY = "sidebar-mood"; // 主題模式儲存鍵
const MOON_ICON = "assets/icons/moon.svg";
const SUN_ICON = "assets/icons/sun.svg";
const HASHTAG_ICON = "assets/icons/hashtag.svg";
const LANGUAGE_KEY = "sidebar-language";
const LOCALE_MAP = { zh: "zh_TW", en: "en", ja: "ja" }; // 語系對應

let messages = {}; // 儲存翻譯文字
let CURRENT_CHAT_KEY = null; // 當前聊天室路徑
let selectedTags = new Set(); // 選取的 Hashtag

// ----- 排序功能 -----
function getSavedSort() {
  return localStorage.getItem(SORT_KEY) || "added"; // 讀取排序方式
}
function saveSort(sort) {
  localStorage.setItem(SORT_KEY, sort); // 儲存排序方式
}

// ----- 語言設定 -----
async function loadMessages(lang) {
  const loc = LOCALE_MAP[lang] || LOCALE_MAP.zh;
  const url = chrome.runtime.getURL(`_locales/${loc}/messages.json`);
  const res = await fetch(url);
  const json = await res.json();
  messages = Object.fromEntries(
    Object.entries(json).map(([k, v]) => [k, v.message])
  );
}

function applyMessages() {
  // 套用翻譯文字到畫面
  document.getElementById("sidebar-title").textContent = messages.sidebarTitle;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = messages[key] || "";
  });
}

async function initLanguage() {
  // 初始化語言選單
  const sel = document.getElementById("language-select");
  const saved = localStorage.getItem(LANGUAGE_KEY) || "zh";
  sel.value = saved;
  await loadMessages(saved);
  applyMessages();
  sel.addEventListener("change", async () => {
    const lang = sel.value;
    localStorage.setItem(LANGUAGE_KEY, lang);
    await loadMessages(lang);
    applyMessages();
    loadSidebarBookmarks();
  });
}

// ----- 讀取書籤與 Hashtag  -----
function fetchBookmarksWithTags(cb) {
  chrome.storage.local.get([CURRENT_CHAT_KEY], (res) => {
    const list = res[CURRENT_CHAT_KEY] || [];
    cb(
      list.map((item) => ({
        ...item,
        hashtags: item.hashtags || [],
      }))
    );
  });
}

// ----- 載入與排序書籤 -----
function loadSidebarBookmarks() {
  if (!CURRENT_CHAT_KEY) return;

  fetchBookmarksWithTags((list) => {
    // 篩選已選 Hashtag
    if (selectedTags.size > 0) {
      list = list.filter((item) =>
        item.hashtags.some((tag) => selectedTags.has(tag))
      );
    }
    const sortOrder = getSavedSort();
    // 依聊天順序排序
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

// ----- 顯示書籤列表 -----
function renderList(list, filterTag = null) {
  const container = document.getElementById("bookmark-list");
  container.innerHTML = "";

  list.forEach((item) => {
    // 處理文字長度
    const fullText = item.content || "";
    const displayText =
      fullText.length > MAX_CONTENT_LENGTH
        ? fullText.slice(0, MAX_CONTENT_LENGTH) + "  . . ."
        : fullText;

    const div = document.createElement("div");
    div.className = "bookmark";
    div.textContent = displayText;
    div.style.cursor = "pointer";
    div.title = messages.scrollToMessageTooltip;
    // 跳轉到原訊息
    div.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) return;
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "scrollToMessage",
          id: item.id,
        });
      });
    });

    // 已有的 Hashtag
    if (item.hashtags.length) {
      const tagLine = document.createElement("div");
      tagLine.className = "tags-list";

      item.hashtags.forEach((tag) => {
        const span = document.createElement("span");
        span.className = "tag-item";
        const text = document.createElement("span");
        text.textContent = `# ${tag}`;
        span.appendChild(text);
        // 移除標籤按鈕
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

    // 新增 Hashtag 按鈕
    const btnTag = document.createElement("button");
    btnTag.className = "tag-btn";
    const icon = document.createElement("img");
    icon.className = "tag-icon";
    icon.src = chrome.runtime.getURL(HASHTAG_ICON);
    icon.alt = "hashtag";
    btnTag.appendChild(icon);
    btnTag.addEventListener("click", () => onAddTag(item.id));
    div.appendChild(btnTag);
    container.appendChild(div);
  });
}

// ----- 新增 Hashtag -----
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

// ----- 移除 Hashtag -----
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

// ----- 標籤篩選 -----
function renderHashtagList() {
  // 顯示 Hashtag 篩選按鈕
  fetchBookmarksWithTags((list) => {
    const all = list.flatMap((item) => item.hashtags);
    const uniq = Array.from(new Set(all));

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

// ----- 刪除書籤 -----
function onRemoveBookmark(bookmarkId) {
  fetchBookmarksWithTags((list) => {
    const updated = list.filter((item) => item.id !== bookmarkId);
    chrome.storage.local.set({ [CURRENT_CHAT_KEY]: updated }, () => {
      renderHashtagList();
      loadSidebarBookmarks();
    });
  });
}

// ----- 初始化與監聽 -----
// 設定當前聊天室並每秒檢查
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

/** 監聽 storage 變動：若當前聊天室的書籤變動，就重新載入 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && CURRENT_CHAT_KEY in changes) {
    loadSidebarBookmarks();
  }
});

// ----- 主題切換功能 -----
// 讀取儲存的主題
function getSavedMood() {
  return localStorage.getItem(MOOD_KEY) || "dark";
}

// 套用主題
function applyMood(mood) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(mood);
  const img = document.getElementById("mood-icon");
  const file = mood === "light" ? MOON_ICON : SUN_ICON;
  img.src = chrome.runtime.getURL(file);
}

// 切換主題並儲存
function toggleMood() {
  const next = getSavedMood() === "light" ? "dark" : "light";
  localStorage.setItem(MOOD_KEY, next);
  applyMood(next);
}

// ----- 初始化 -----
document.addEventListener("DOMContentLoaded", async () => {
  await initLanguage();
  loadSidebarBookmarks();

  applyMood(getSavedMood());
  document.getElementById("mood-toggle").addEventListener("click", toggleMood);

  const sortSelect = document.getElementById("sort-order");
  sortSelect.value = getSavedSort();
  sortSelect.addEventListener("change", () => {
    saveSort(sortSelect.value);
    loadSidebarBookmarks();
  });

  initCurrentKeyAndLoad();
  setInterval(initCurrentKeyAndLoad, 1000);

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
});

// ----- 自動刷新 -----
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && CURRENT_CHAT_KEY in changes) {
    renderHashtagList();
    loadSidebarBookmarks();
  }
});
