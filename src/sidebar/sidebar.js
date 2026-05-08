// ===== 全域設定 =====
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

// sidebar 書籤摘要最大顯示字數
const MAX_CONTENT_LENGTH = 30;
const SIDEBAR_FALLBACK_POLL_INTERVAL = 5000;
// sidebar 排序、theme、語系的 storage key
const SORT_KEY = STORAGE_KEYS.SIDEBAR_SORT_ORDER;
const MOOD_KEY = STORAGE_KEYS.SIDEBAR_MOOD;
const LANGUAGE_KEY = STORAGE_KEYS.SIDEBAR_LANGUAGE;

const HASHTAG_ICON = ICONS.HASHTAG;
const TRASH_ICON = ICONS.TRASH;

// i18n catalog、目前 conversation key 與 hashtag filter 狀態
let messages = {};
let CURRENT_CHAT_KEY = null;
let selectedTags = new Set();

// ===== 主頁狀態同步 =====
chrome.runtime.onMessage.addListener((msg) => {
  if (
    msg.type === MESSAGE_TYPES.CHATGPT_READY ||
    msg.type === MESSAGE_TYPES.CHATGPT_ROUTE_CHANGED ||
    msg.type === MESSAGE_TYPES.CHATGPT_THEME_CHANGED
  ) {
    syncActiveTabState();
  }
});

// ===== Theme 設定 =====
let _mqListener = null;
let activeMood = "system";

function removeMoodListener() {
  if (!_mqListener) return;
  _mqListener.mq.removeEventListener("change", _mqListener.fn);
  _mqListener = null;
}

// 套用 sidebar theme，system 模式會綁定 prefers-color-scheme
function applyMood(mood) {
  activeMood = mood || "system";
  document.body.classList.remove("light", "dark");
  // 切換前先移除舊的 system listener
  removeMoodListener();

  if (activeMood === "system") {
    // system theme 依 OS 設定即時切換
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    document.body.classList.add(mq.matches ? "dark" : "light");
    const fn = (e) => {
      document.body.classList.toggle("dark", e.matches);
      document.body.classList.toggle("light", !e.matches);
      clearChatThemeColors();
      syncActiveTabTheme();
    };
    mq.addEventListener("change", fn);
    _mqListener = { mq, fn };
  } else {
    // 固定套用 light/dark
    document.body.classList.add(activeMood);
  }
}

function clearChatThemeColors() {
  document.body.classList.remove("chatgpt-theme-synced");
  document.body.style.removeProperty("--sidebar-bg");
  document.body.style.removeProperty("--sidebar-fg");
  applyMood(activeMood);
}

function applyChatThemeColors(colors) {
  if (!colors?.background || !colors?.text) {
    clearChatThemeColors();
    return;
  }

  const sidebarIsDark =
    activeMood === "system"
      ? document.body.classList.contains("dark")
      : activeMood === "dark";

  if (colors.isDark !== sidebarIsDark) {
    clearChatThemeColors();
    return;
  }

  document.body.classList.remove("light", "dark");
  document.body.classList.add(sidebarIsDark ? "dark" : "light");
  document.body.classList.add("chatgpt-theme-synced");
  document.body.style.setProperty("--sidebar-bg", colors.background);
  document.body.style.setProperty("--sidebar-fg", colors.text);
}

function syncActiveTabTheme(tab, didQueryActiveTab = false) {
  if (!tab) {
    if (didQueryActiveTab) {
      clearChatThemeColors();
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) =>
      syncActiveTabTheme(tabs[0], true)
    );
    return;
  }

  if (!tab?.id || !isAllowedChatOrigin(tab.url || "")) {
    clearChatThemeColors();
    return;
  }

  chrome.tabs.sendMessage(
    tab.id,
    { type: MESSAGE_TYPES.GET_CHAT_THEME_COLORS },
    (response) => {
      if (chrome.runtime.lastError || !response?.colors) {
        clearChatThemeColors();
        return;
      }
      applyChatThemeColors(response.colors);
    }
  );
}

// storage theme 變更時即時更新 sidebar
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === "local" || area === "sync") && changes[MOOD_KEY]) {
    applyMood(changes[MOOD_KEY].newValue);
    syncActiveTabTheme();
  }
});

// ===== i18n 設定 =====
// 載入指定 locale 的 message catalog
async function loadMessages(lang) {
  const loc = LOCALES[lang] || LOCALES.en;
  const url = chrome.runtime.getURL(`_locales/${loc}/messages.json`);
  const res = await fetch(url);
  const json = await res.json();
  messages = Object.fromEntries(
    Object.entries(json).map(([k, v]) => [k, v.message])
  );
}
// 將 message catalog 套用至 UI
function applyMessages() {
  document.getElementById("sidebar-title").textContent = messages.sidebarTitle;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = messages[key] || "";
  });
}
// storage 語系變更時重新載入 i18n
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === "local" || area === "sync") && changes[LANGUAGE_KEY]) {
    const newLang = changes[LANGUAGE_KEY].newValue;
    loadMessages(newLang).then(applyMessages);
  }
});

// ===== Bookmark 與 Hashtag =====
// 從 local/sync 取得目前 conversation 的有效 bookmark
function fetchBookmarksWithTags(cb) {
  if (!CURRENT_CHAT_KEY) return cb([]);
  dualGet(CURRENT_CHAT_KEY).then((list) => {
    const cleaned = list.map(withDefaults).filter((it) => !it.deleted);
    cb(cleaned);
  });
}

// 新增 bookmark hashtag
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
// 移除 bookmark hashtag
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

function refreshActiveTabBookmarkIcons() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id || !isAllowedChatOrigin(tab.url || "")) return;

    chrome.tabs.sendMessage(
      tab.id,
      { type: MESSAGE_TYPES.REFRESH_BOOKMARK_ICONS },
      () => chrome.runtime.lastError
    );
  });
}

// 刪除 bookmark；保留 tombstone 以避免 sync merge 復活舊資料
function onDeleteBookmark(bookmarkId) {
  if (!CURRENT_CHAT_KEY) return;
  dualRead(CURRENT_CHAT_KEY).then((list) => {
    const now = Date.now();
    const updated = list.map((it) => {
      if (it.id !== bookmarkId) return it;
      return { ...withDefaults(it), deleted: true, updatedAt: now };
    });
    dualSet(CURRENT_CHAT_KEY, updated).then(() => {
      renderHashtagList();
      loadSidebarBookmarks();
      refreshActiveTabBookmarkIcons();
    });
  });
}

// 渲染 hashtag filter button
function renderHashtagList() {
  fetchBookmarksWithTags((list) => {
    const all = list.flatMap((item) => item.hashtags);
    const uniq = Array.from(new Set(all));
    // 移除已不存在的 selected hashtag
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

// ===== 排序設定 =====
// 讀取 sidebar sort order
function getSavedSort() {
  return localStorage.getItem(SORT_KEY) || "added";
}
// 儲存 sidebar sort order
function saveSort(sort) {
  localStorage.setItem(SORT_KEY, sort);
}

// ===== 載入與排序書籤 =====
function loadSidebarBookmarks() {
  if (!CURRENT_CHAT_KEY) return;
  fetchBookmarksWithTags((list) => {
    // 套用 hashtag filter
    if (selectedTags.size) {
      list = list.filter((item) =>
        (item.hashtags || []).some((tag) => selectedTags.has(tag))
      );
    }

    // 套用排序策略
    const sortOrder = getSavedSort();
    if (sortOrder === "chat") {
      // 依 ChatGPT DOM 中的 conversation order 排序
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
      // 依加入時間排序；舊資料 fallback 至 updatedAt
      list.sort((a, b) => {
        const ta = a.createdAt || a.updatedAt || 0;
        const tb = b.createdAt || b.updatedAt || 0;
        return ta - tb;
      });
      renderList(list);
    }
  });
}

// ===== Sidebar reset 清理 =====
function clearSidebar() {
  const list = document.getElementById("bookmark-list");
  if (list) list.innerHTML = "";
  const tagBox = document.getElementById("hashtag-container");
  if (tagBox) tagBox.innerHTML = "";
  selectedTags.clear();
}

// ===== Bookmark list render 書籤列表 =====
function renderList(list) {
  const container = document.getElementById("bookmark-list");
  container.innerHTML = "";
  list.forEach((item) => {
    // 摘要超過上限時截斷顯示
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
    // 顯示 bookmark tags
    if (item.hashtags.length) {
      const tagLine = document.createElement("div");
      tagLine.className = "tags-list";
      item.hashtags.forEach((tag) => {
        const span = document.createElement("span");
        span.className = "tag-item";
        span.textContent = `# ${tag}`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "remove-tag-btn";
        btn.title = messages.removeHashtagTooltip;
        btn.setAttribute("aria-label", messages.removeHashtagTooltip);
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
    // 新增 hashtag action button
    const btnTag = document.createElement("button");
    btnTag.type = "button";
    btnTag.className = "tag-btn hashtag-btn";
    btnTag.title = messages.addHashtagTooltip;
    btnTag.setAttribute("aria-label", messages.addHashtagTooltip);
    const icon = document.createElement("img");
    icon.className = "tag-icon";
    icon.src = chrome.runtime.getURL(HASHTAG_ICON);
    btnTag.appendChild(icon);
    btnTag.addEventListener("click", (e) => {
      e.stopPropagation();
      onAddTag(item.id);
    });
    div.appendChild(btnTag);

    // 刪除 bookmark action button
    const btnTrash = document.createElement("button");
    btnTrash.type = "button";
    btnTrash.className = "tag-btn trash-btn";
    btnTrash.title = messages.deleteBookmarkTooltip;
    btnTrash.setAttribute("aria-label", messages.deleteBookmarkTooltip);
    const trashIcon = document.createElement("img");
    trashIcon.className = "tag-icon";
    trashIcon.src = chrome.runtime.getURL(TRASH_ICON);
    btnTrash.appendChild(trashIcon);
    btnTrash.addEventListener("click", (e) => {
      e.stopPropagation();
      onDeleteBookmark(item.id);
    });
    div.appendChild(btnTrash);

    container.appendChild(div);
  });
}

// ===== Route 與 storage watcher =====
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

  // 有 conversation key 時，切換聊天室或空畫面都重新載入
  if (path !== CURRENT_CHAT_KEY || listEmpty) {
    CURRENT_CHAT_KEY = path;
    bindStorageWatcherForKey(CURRENT_CHAT_KEY);
    renderHashtagList();
    loadSidebarBookmarks();
  }
}

function syncActiveTabState() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    syncActiveTabTheme(tab);

    if (!tab?.url) return;
    if (!isAllowedChatOrigin(tab.url)) {
      applyActiveChatPath(null);
      return;
    }

    const path = getChatKeyFromPathname(new URL(tab.url).pathname);
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

// ===== DOMContentLoaded 初始化 =====
document.addEventListener("DOMContentLoaded", async () => {
  // 載入語系並套用 i18n
  const lang = await dualGetSetting(LANGUAGE_KEY, "en");
  await loadMessages(lang);
  applyMessages();

  // 初始化 bookmark 狀態與 active tab 監聽
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

        // 為目前 tab 暫時掛上 popup
        await chrome.action.setPopup({
          tabId: tab.id,
          popup: PATHS.POPUP_PAGE,
        });

        // openPopup 必須在 user gesture 內呼叫
        await chrome.action.openPopup();

        // 請 background 立即清除 popup 綁定
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.CLEAR_ACTION_POPUP_FOR_ACTIVE_TAB,
        });

        // 備援清理，避免 service worker 未收到 message
        setTimeout(
          () => chrome.action.setPopup({ tabId: tab.id, popup: "" }),
          0
        );
      } catch {
        // 維持只開 sidebar 的設計；失敗時不再開 fallback window
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

// ===== Scroll 控制 =====
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
