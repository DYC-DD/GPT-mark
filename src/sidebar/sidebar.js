// ----- 全域設定 -----
const {
  CHATGPT_ORIGINS,
  ICONS,
  LOCALES,
  MESSAGE_TYPES,
  PATHS,
  STORAGE_KEYS,
  getChatKeyFromPathname,
  isAllowedChatOrigin,
} = self.GPT_MARK;

// 最大書籤顯示字數
const MAX_CONTENT_LENGTH = 30;
const SIDEBAR_FALLBACK_POLL_INTERVAL = 5000;
// 側邊欄排序、主題、語系儲存鍵
const SORT_KEY = STORAGE_KEYS.SIDEBAR_SORT_ORDER;
const MOOD_KEY = STORAGE_KEYS.SIDEBAR_MOOD;
const LANGUAGE_KEY = STORAGE_KEYS.SIDEBAR_LANGUAGE;

const HASHTAG_ICON = ICONS.HASHTAG;

// 儲存讀取到的翻譯文字、目前聊天室 key、以及已選的 Hashtag
let messages = {};
let CURRENT_CHAT_KEY = null;
let selectedTags = new Set();

// ----- 等待主頁載入完成並初始化 -----
chrome.runtime.onMessage.addListener((msg) => {
  if (
    msg.type === MESSAGE_TYPES.CHATGPT_READY ||
    msg.type === MESSAGE_TYPES.CHATGPT_ROUTE_CHANGED
  ) {
    syncActiveTabState();
  }
});

// ----- 主題切換功能 -----
let _mqListener = null;
// 根據 mood 參數套用頁面主題
function applyMood(mood) {
  document.body.classList.remove("light", "dark");
  // 若已有 system 監聽，先解除
  if (_mqListener) {
    _mqListener.mq.removeEventListener("change", _mqListener.fn);
    _mqListener = null;
  }

  if (mood === "system") {
    // 依系統動態監聽切換
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    document.body.classList.add(mq.matches ? "dark" : "light");
    const fn = (e) => {
      document.body.classList.toggle("dark", e.matches);
      document.body.classList.toggle("light", !e.matches);
    };
    mq.addEventListener("change", fn);
    _mqListener = { mq, fn };
  } else {
    // 明確指定 light / dark
    document.body.classList.add(mood);
  }
}
// 監聽主題變動並立即套用新主題
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === "local" || area === "sync") && changes[MOOD_KEY]) {
    applyMood(changes[MOOD_KEY].newValue);
  }
});

// ----- 語言設定功能 -----
// 讀取指定語系的翻譯訊息
async function loadMessages(lang) {
  const loc = LOCALES[lang] || LOCALES.zh;
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
  if ((area === "local" || area === "sync") && changes[LANGUAGE_KEY]) {
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
        if (!CHATGPT_ORIGINS.includes(origin)) {
          renderList(list);
          return;
        }
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: MESSAGE_TYPES.GET_CHAT_ORDER },
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
        ? fullText.slice(0, MAX_CONTENT_LENGTH) + " ......"
        : fullText;
    const div = document.createElement("div");
    div.className = "bookmark";
    div.textContent = displayText;
    div.title = messages.scrollToMessageTooltip;
    div.style.cursor = "pointer";
    div.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: MESSAGE_TYPES.SCROLL_TO_MESSAGE,
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
let unbindBookmarkStorage = null;

function bindStorageWatcherForKey(key) {
  if (BOUND_KEY === key) return;

  if (unbindBookmarkStorage) {
    unbindBookmarkStorage();
    unbindBookmarkStorage = null;
  }

  BOUND_KEY = key;
  if (!BOUND_KEY) return;

  const watchedKey = BOUND_KEY;
  unbindBookmarkStorage = onKeyStorageChanged(watchedKey, () => {
    if (CURRENT_CHAT_KEY !== watchedKey) return;
    renderHashtagList();
    loadSidebarBookmarks();
  });
}

function applyActiveChatPath(path) {
  const listEmpty = !document.getElementById("bookmark-list").childElementCount;

  if (!path) {
    bindStorageWatcherForKey(null);
    if (CURRENT_CHAT_KEY !== null || !listEmpty) {
      CURRENT_CHAT_KEY = null;
      clearSidebar();
    }
    return;
  }

  // 有 chatId：切換聊天室或畫面是空的 → 載入
  if (path !== CURRENT_CHAT_KEY || listEmpty) {
    CURRENT_CHAT_KEY = path;
    bindStorageWatcherForKey(CURRENT_CHAT_KEY);
    renderHashtagList();
    loadSidebarBookmarks();
  }
}

function syncActiveTabState() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.url) return;
    if (!isAllowedChatOrigin(tabs[0].url)) {
      applyActiveChatPath(null);
      return;
    }

    const path = getChatKeyFromPathname(new URL(tabs[0].url).pathname);
    applyActiveChatPath(path);
  });
}

function bindActiveTabEvents() {
  chrome.tabs.onActivated.addListener(() => syncActiveTabState());
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) syncActiveTabState();
  });
  chrome.windows.onFocusChanged.addListener(() => syncActiveTabState());
}

// 頁面載入後執行一次初始化；之後以事件驅動為主，低頻輪詢作為備援
document.addEventListener("DOMContentLoaded", async () => {
  // 載入語系與套用文字
  const lang = await dualGetSetting(LANGUAGE_KEY, "zh");
  await loadMessages(lang);
  applyMessages();

  // 初始化書籤
  syncActiveTabState();
  bindActiveTabEvents();
  setInterval(syncActiveTabState, SIDEBAR_FALLBACK_POLL_INTERVAL);

  document
    .getElementById("settings-button")
    .addEventListener("click", async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab?.id) throw new Error("No active tab");

        // 1) 臨時指定此分頁的 popup
        await chrome.action.setPopup({
          tabId: tab.id,
          popup: PATHS.POPUP_PAGE,
        });

        // 2) 立刻開啟（必須在使用者點擊手勢中呼叫）
        await chrome.action.openPopup();

        // 3) 立刻要求背景程式清掉（比 setTimeout 更可靠）
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.CLEAR_ACTION_POPUP_FOR_ACTIVE_TAB,
        });

        // 可留著當備援：確保就算 SW 沒收到訊息，也會清掉
        setTimeout(
          () => chrome.action.setPopup({ tabId: tab.id, popup: "" }),
          0
        );
      } catch {
        // 後備視窗已移除，因你要求「只開側欄不開小窗」
      }
    });

  const sortSelect = document.getElementById("sort-order");
  sortSelect.value = getSavedSort();
  sortSelect.addEventListener("change", () => {
    saveSort(sortSelect.value);
    loadSidebarBookmarks();
  });
  applyMood(await dualGetSetting(MOOD_KEY, "system"));
});

// ----- 滾動按鈕功能 -----
document.getElementById("scroll-top-btn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: MESSAGE_TYPES.SCROLL_TO_TOP });
  });
});
document.getElementById("scroll-bottom-btn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: MESSAGE_TYPES.SCROLL_TO_BOTTOM,
    });
  });
});
