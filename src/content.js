console.log("ChatGPT Bookmark 插件已載入！");

// ---------- 編輯下 Enter 雙擊送出功能 ----------
let sendButton = null;
let enterPressCount = 0;
let enterPressTimer = null;
const DOUBLE_CLICK_DELAY = 200; // 雙擊的延遲時間（毫秒）

// 檢查目前事件目標是否為 ChatGPT 的輸入框
function isChatInput(target) {
  if (target.tagName === "TEXTAREA") return true;
  if (target.role === "textbox" && target.dataset.testid === "text-input")
    return true;
  if (target.classList.contains("grow-wrap")) return true;
  if (target.matches("div.flex-grow.relative > div > textarea")) return true;
  return false;
}

// 判斷是否處在「編輯回覆」模式
function isEditingMode() {
  const editSendButton = document.querySelector(
    "button.btn.relative.btn-primary"
  );
  return !!editSendButton;
}

// 嘗試在各種可能的地方找到「送出」按鈕
function findSendButton() {
  // 優先使用 data-testid
  let button = document.querySelector('[data-testid="send-button"]');
  if (button) return button;
  // 再依次嘗試常見按鈕樣式
  button = document.querySelector("button.btn.relative.btn-primary");
  if (button) return button;
  button = document.querySelector('button[aria-label="Send message"]');
  if (button) return button;
  button = document.querySelector('button[aria-label="Send"]');
  if (button) return button;
  // 最後掃描所有 button，找文字包含「傳送」或「Save & Submit」
  const buttons = document.querySelectorAll("button");
  for (const btn of buttons) {
    if (
      btn.textContent.includes("傳送") ||
      btn.textContent.includes("Save & Submit")
    ) {
      return btn;
    }
  }
  return null;
}

// 在指定的輸入框中插入換行符
function insertNewline(targetElement) {
  if (targetElement) {
    const start = targetElement.selectionStart;
    const end = targetElement.selectionEnd;
    const text = targetElement.value;
    targetElement.value = text.substring(0, start) + "\n" + text.substring(end);
    targetElement.selectionStart = targetElement.selectionEnd = start + 1;
    const event = new Event("input", { bubbles: true });
    targetElement.dispatchEvent(event);
  }
}

// 處理全域的 keydown 事件
function handleKeyDown(event) {
  const currentInputTarget = event.target;
  if (isChatInput(currentInputTarget)) {
    const inEditingMode = isEditingMode();
    // Shift+Enter 一律換行
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      insertNewline(currentInputTarget);
      enterPressCount = 0;
      clearTimeout(enterPressTimer);
      enterPressTimer = null;
      return;
    }

    // 僅在編輯模式下應用單擊換行、雙擊發送的邏輯
    if (inEditingMode) {
      // 處理 Enter 鍵按下，且非輸入法選字狀態
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        enterPressCount++;

        if (enterPressCount === 1) {
          // 第一次按下 Enter，啟動計時器判斷是否為單擊
          enterPressTimer = setTimeout(() => {
            if (enterPressCount === 1) {
              console.log("ChatGPT：編輯模式 - 單擊Enter（換行）。");
              insertNewline(currentInputTarget);
            }
            enterPressCount = 0;
            enterPressTimer = null;
          }, DOUBLE_CLICK_DELAY);
        } else if (enterPressCount === 2) {
          // 第二次按下 Enter（在延遲時間內），執行發送操作
          clearTimeout(enterPressTimer);
          enterPressCount = 0;
          enterPressTimer = null;

          sendButton = findSendButton();
          if (sendButton) {
            sendButton.click();
            console.log("ChatGPT：編輯模式 - 雙擊Enter（發送）。");
          } else {
            console.warn("ChatGPT：編輯模式 - 未找到發送按鈕。請檢查插件。");
          }
        }
      }
    } else {
      enterPressCount = 0;
      clearTimeout(enterPressTimer);
      enterPressTimer = null;
    }
  } else {
    enterPressCount = 0;
    clearTimeout(enterPressTimer);
    enterPressTimer = null;
  }
}

// 將鍵盤事件監聽器添加到整個文檔
document.addEventListener("keydown", handleKeyDown);

// ---------- 書籤功能 ----------
// ---- 常數設定 ----
const SYNC_BYTES_PER_ITEM = 8192; // Chrome sync 單一 key 最大可儲存位元組數
const SYNC_SOFT_LIMIT = 7000; // 分片時的軟限制，留空間避免超標
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 墓碑保留 30 天
const MAX_SYNC_CONTENT_CHARS = 512; // 影子版本中 content 最多保留的字元數

// ---- 工具函式 ----
// 計算物件序列化後的大小（bytes）
function sizeBytes(obj) {
  return new Blob([JSON.stringify(obj)]).size;
}
// 生成分片索引 key
function idxKey(prefix) {
  return `${prefix}::idx`;
}
// 生成單一分片 key
function shardKey(prefix, i) {
  return `${prefix}::${i}`;
}

// 補齊缺少欄位的資料，確保每筆都有完整結構
function withDefaults(item) {
  return {
    id: item.id,
    content: item.content ?? "",
    role: item.role ?? "unknown",
    hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
    deleted: !!item.deleted,
    updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : 0,
    __shadow: !!item.__shadow,
  };
}

// 建立影子版本（截短 content）用於 sync 儲存
function toShadow(item) {
  const it = withDefaults(item);
  return {
    ...it,
    content: (it.content || "").slice(0, MAX_SYNC_CONTENT_CHARS),
    __shadow: true,
  };
}

// 取較長內容，避免影子覆蓋完整內容
function takeRicherContent(base, other) {
  const bc = (base.content || "").length;
  const oc = (other.content || "").length;
  if (oc > bc) base.content = other.content;
  return base;
}

// 合併兩筆相同 id 的資料（取較新版本、hashtags 聯集）
function mergeItems(a, b) {
  const A = withDefaults(a),
    B = withDefaults(b);

  // 新舊決定以 updatedAt 為準
  if (A.updatedAt !== B.updatedAt) {
    const newer = A.updatedAt > B.updatedAt ? A : B;
    const older = newer === A ? B : A;
    return takeRicherContent({ ...newer }, older);
  }

  // 若時間相同，hashtags 聯集，刪除狀態 OR 合併
  const hs = Array.from(
    new Set([...(A.hashtags || []), ...(B.hashtags || [])])
  );
  const deleted = !!(A.deleted || B.deleted);
  const base = { ...A, hashtags: hs, deleted };
  return takeRicherContent(base, B);
}

// 合併 local + sync 清單，並移除過期墓碑
function mergeLists(listA = [], listB = []) {
  const map = new Map();
  [...listA, ...listB].forEach((raw) => {
    const it = withDefaults(raw);
    const prev = map.get(it.id);
    map.set(it.id, prev ? mergeItems(prev, it) : it);
  });
  const now = Date.now();
  return Array.from(map.values()).filter(
    (it) =>
      !(it.deleted && it.updatedAt && now - it.updatedAt > TOMBSTONE_TTL_MS)
  );
}

// ---- sync sharding helpers ----
// 將清單轉成適合寫入 sync 的版本（超過軟限制會轉影子版本）ㄋ
function makeSyncShadowList(list) {
  return list.map((it) => {
    const full = withDefaults(it);
    if (sizeBytes(full) > SYNC_SOFT_LIMIT) return toShadow(full);
    return full;
  });
}

// 從 sync 讀取完整分片資料
async function syncGetAll(prefix) {
  const key = idxKey(prefix);
  const { [key]: idx = [] } = await chrome.storage.sync.get([key]);
  if (!Array.isArray(idx) || idx.length === 0) return [];
  const shardKeys = idx.map((i) => shardKey(prefix, i));
  const res = await chrome.storage.sync.get(shardKeys);
  const out = [];
  for (const k of shardKeys) out.push(...(res[k] || []));
  return out;
}

// 寫入 sync：將清單拆分成多個 shard，同時更新索引
async function syncSetShards(prefix, list) {
  const safeList = makeSyncShadowList(list);
  const shards = [];
  let cur = [];
  for (const item of safeList) {
    const probe = [...cur, item];
    if (sizeBytes(probe) > SYNC_SOFT_LIMIT) {
      if (cur.length === 0) {
        shards.push([item]);
        cur = [];
      } else {
        shards.push(cur);
        cur = [item];
      }
    } else {
      cur = probe;
    }
  }
  if (cur.length) shards.push(cur);

  const indexK = idxKey(prefix);
  const batch = { [indexK]: shards.map((_, i) => i) };
  const used = new Set();

  shards.forEach((arr, i) => {
    const k = shardKey(prefix, i);
    used.add(k);
    batch[k] = arr;
  });

  const prev = await chrome.storage.sync.get([indexK]);
  const prevIdx = prev[indexK] || [];
  const obsolete = prevIdx
    .map((i) => shardKey(prefix, i))
    .filter((k) => !used.has(k));

  await chrome.storage.sync.set(batch);
  if (obsolete.length) await chrome.storage.sync.remove(obsolete);
}

// ---- public API ----
// 寫入 sync：將清單拆分成多個 shard，同時更新索引
async function dualGet(key) {
  const [loc, synList] = await Promise.all([
    chrome.storage.local.get([key]),
    syncGetAll(key),
  ]);
  const merged = mergeLists(loc[key], synList);
  await chrome.storage.local.set({ [key]: merged });
  try {
    await syncSetShards(key, merged);
  } catch (e) {}
  return merged;
}

// 同時寫入 local 和 sync
async function dualSet(key, list) {
  await chrome.storage.local.set({ [key]: list });
  try {
    await syncSetShards(key, list);
  } catch (e) {
    console.warn("[DualStorage] syncSetShards failed:", e);
  }
}

// 監聽 local + sync 指定 key 的變動
function onKeyStorageChanged(prefix, handler) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[prefix]) {
      handler();
      return;
    }
    if (area === "sync") {
      const ks = Object.keys(changes);
      const hit = ks.some(
        (k) => k === idxKey(prefix) || k.startsWith(prefix + "::")
      );
      if (hit) handler();
    }
  });
}

const SCAN_INTERVAL = 2000; // 動態載入的掃描間隔（毫秒）
const EMPTY_ICON = "assets/icons/bookmarks.svg";
const FILL_ICON = "assets/icons/bookmarks-fill.svg";

// 將任意 /g/.../c/<chatId> 或 /c/<chatId>/ 統一為 /c/<chatId>
function normalizePath(p) {
  p = p.replace(/\/$/, ""); // 去掉尾斜線
  const m = p.match(/^\/g\/[^/]+\/c\/([^/]+)$/); // 群組頁面格式
  if (m) return `/c/${m[1]}`; // 取出 chatId
  return p;
}

// 回傳目前聊天室的 storage key（或 null）
function getCurrentChatKey() {
  const p = normalizePath(window.location.pathname);
  // 只有 /c（列表頁）或 /g/.../c（還沒展開 chatId）時先不寫入
  if (p === "/c" || /^\/g\/[^/]+\/c$/.test(window.location.pathname))
    return null;
  return p;
}

// ---- 舊資料一次性搬家：把 /g/.../c/<id> → /c/<id> ----
chrome.storage.local.get(null, (all) => {
  Object.entries(all).forEach(([k, v]) => {
    const m = k.match(/^\/g\/[^/]+\/c\/([^/]+)\/?$/);
    if (m) {
      const target = `/c/${m[1]}`;
      if (!(target in all)) {
        chrome.storage.local.set({ [target]: v }, () =>
          chrome.storage.local.remove(k)
        );
      }
    }
  });
});

// 從 chrome.storage.local 拿到當前聊天室的所有書籤
function fetchBookmarks(cb) {
  const key = getCurrentChatKey();
  if (!key) return cb([]);
  dualGet(key).then((list) => cb(list));
}

// 將書籤列表存回 local storage
function saveBookmarks(list) {
  const key = getCurrentChatKey();
  if (!key) return;
  dualSet(key, list);
}

//判斷訊息是否已是書籤
function isBookmarked(id, list) {
  return list.some((it) => it.id === id && !it.deleted);
}

// 切換書籤：若已存在就切換墓碑；不存在就新增
function toggleBookmark(id, content, role, cb) {
  fetchBookmarks((list) => {
    const now = Date.now();
    const idx = list.findIndex((it) => it.id === id);
    let updated;

    if (idx >= 0) {
      const cur = withDefaults(list[idx]);
      const willDelete = !cur.deleted;
      const resurrecting = !willDelete;

      updated = list.map((it, i) => {
        if (i !== idx) return it;
        return {
          ...cur,
          deleted: willDelete,
          hashtags: resurrecting ? [] : cur.hashtags,
          createdAt: resurrecting ? now : cur.createdAt || now,
          updatedAt: now,
        };
      });
    } else {
      updated = [
        ...list,
        {
          id,
          content,
          role,
          hashtags: [],
          deleted: false,
          createdAt: now,
          updatedAt: now,
        },
      ];
    }

    saveBookmarks(updated);
    cb && cb(updated);
  });
}

// 根據主題回傳背景顏色
function getHoverBgColor() {
  return document.documentElement.classList.contains("dark")
    ? "#303030"
    : "#E8E8E8";
}

// 根據主題回傳 icon 濾鏡
function getIconFilter() {
  return document.documentElement.classList.contains("dark")
    ? "brightness(0) invert(1)"
    : "brightness(0)";
}

// 建立書籤按鈕
function createBookmarkButton(msg) {
  const id = msg.dataset.messageId;
  // 已有或無 id 都不再處理
  if (
    !id ||
    document.querySelector(`.chatgpt-bookmark-btn[data-bookmark-id="${id}"]`)
  ) {
    return null;
  }

  // 按鈕基本樣式
  const btn = document.createElement("button");
  btn.className = "chatgpt-bookmark-btn";
  btn.title = "書籤";
  btn.setAttribute("data-bookmark-id", id);
  Object.assign(btn.style, {
    width: "32px",
    height: "32px",
    background: "transparent",
    border: "none",
    borderRadius: "8px",
    padding: "0",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background-color 0.2s",
  });

  // 建立 icon 根據是否已書籤設定圖示
  const icon = document.createElement("img");
  Object.assign(icon.style, {
    width: "16px",
    height: "16px",
    pointerEvents: "none",
    filter: getIconFilter(),
  });
  btn.appendChild(icon);

  // 初始設定圖示狀態
  fetchBookmarks((list) => {
    const file = isBookmarked(id, list) ? FILL_ICON : EMPTY_ICON;
    icon.src = chrome.runtime.getURL(file);
  });

  // 點擊切換書籤
  btn.addEventListener("click", () => {
    const content = msg.innerText.trim();
    const role = msg.dataset.messageAuthorRole || "unknown";
    toggleBookmark(id, content, role, (updated) => {
      const file = isBookmarked(id, updated) ? FILL_ICON : EMPTY_ICON;
      icon.src = chrome.runtime.getURL(file);
    });
  });
  btn.addEventListener(
    "mouseenter",
    () => (btn.style.backgroundColor = getHoverBgColor())
  );
  btn.addEventListener(
    "mouseleave",
    () => (btn.style.backgroundColor = "transparent")
  );

  return btn;
}

// 嘗試將書籤按鈕注入到指定訊息
function tryInjectButton(msg) {
  const btn = createBookmarkButton(msg);
  if (!btn) return;

  // 優先插在「複製按鈕」左側
  const turn = msg.closest("article");
  const copyBtn = turn?.querySelector(
    '[data-testid="copy-turn-action-button"]'
  );
  if (copyBtn && copyBtn.parentNode) {
    // 複製按鈕已存在，直接插在它左邊
    copyBtn.parentNode.insertBefore(btn, copyBtn);
  } else {
    // 複製按鈕還沒出現，500ms 後再嘗試一次
    setTimeout(() => {
      const delayed = turn?.querySelector(
        '[data-testid="copy-turn-action-button"]'
      );
      if (delayed && delayed.parentNode) {
        delayed.parentNode.insertBefore(btn, delayed);
      }
    }, 500);
  }
}

// 為目前頁面所有已渲染的訊息注入書籤按鈕
function injectExistingBookmarks() {
  document
    .querySelectorAll("[data-message-id]")
    .forEach((msg) => tryInjectButton(msg));
}

// 監聽新加入的 turn 節點，自動插入書籤按鈕
function observeAllTurns() {
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches('[data-testid="copy-turn-action-button"]')) {
          const turn = node.closest("article");
          const msg = turn?.querySelector("[data-message-id]");
          if (msg) tryInjectButton(msg);
          continue;
        }

        const copyBtn = node.querySelector
          ? node.querySelector('[data-testid="copy-turn-action-button"]')
          : null;
        if (copyBtn) {
          const turn = copyBtn.closest("article");
          const msg = turn?.querySelector("[data-message-id]");
          if (msg) tryInjectButton(msg);
          continue;
        }

        const msgNode = node.matches("[data-message-id]")
          ? node
          : node.querySelector("[data-message-id]");
        if (msgNode) {
          const turn = msgNode.closest("article");
          const btnArea = turn?.querySelector(
            '[data-testid="copy-turn-action-button"]'
          );
          if (btnArea) tryInjectButton(msgNode);
        }
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-message-id"],
  });
}

// 更新所有書籤 icon 的濾鏡（配合主題切換）
function updateBookmarkIcons() {
  const filter = getIconFilter();
  document.querySelectorAll(".chatgpt-bookmark-btn img").forEach((icon) => {
    icon.style.filter = filter;
  });
}

// 監聽 <html> class 變化（dark / light 切換）
function observeMoodChange() {
  const observer = new MutationObserver(() => {
    updateBookmarkIcons();
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

// ----- 啟動流程 -----
// 等到整個頁面 load 完才開始注入與監聽
window.addEventListener("load", () => {
  injectExistingBookmarks();
  observeAllTurns();
  observeMoodChange();
  setInterval(injectExistingBookmarks, SCAN_INTERVAL);
});

// ----- 路由變化偵測 -----
(function (H) {
  ["pushState", "replaceState"].forEach((type) => {
    const orig = H[type];
    H[type] = function () {
      const ret = orig.apply(this, arguments);
      window.dispatchEvent(new Event("chatgpt-location-change"));
      return ret;
    };
  });
})(history);

let lastPath = location.pathname;

// 當路徑改變時，延遲注入並更新 icon
function handleLocationChange() {
  if (location.pathname === lastPath) return;
  lastPath = location.pathname;
  setTimeout(() => {
    injectExistingBookmarks();
    updateBookmarkIcons();
  }, 600);
}

// 綁定自訂事件與 popstate
window.addEventListener("chatgpt-location-change", handleLocationChange);
window.addEventListener("popstate", handleLocationChange);

function refreshBookmarkIcons() {
  fetchBookmarks((list) => {
    document.querySelectorAll(".chatgpt-bookmark-btn").forEach((btn) => {
      const id = btn.dataset.bookmarkId;
      const icon = btn.firstElementChild;
      const file = isBookmarked(id, list) ? FILL_ICON : EMPTY_ICON;
      icon.src = chrome.runtime.getURL(file);
    });
  });
}

function handleLocationChange() {
  if (location.pathname === lastPath) return;
  lastPath = location.pathname;
  setTimeout(() => {
    injectExistingBookmarks();
    refreshBookmarkIcons();
  }, 600);
}

// ----- 滾動到特定訊息並高亮提示 -----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "scrollToMessage") {
    const msgElem = document.querySelector(`[data-message-id="${message.id}"]`);
    if (msgElem) {
      msgElem.scrollIntoView({ behavior: "smooth", block: "start" });
      msgElem.style.transition = "background-color 0.5s";
      msgElem.style.backgroundColor = "#ffff99";
      setTimeout(() => {
        msgElem.style.backgroundColor = "";
      }, 1000);
    }
    sendResponse({ result: "scrolled" });
  }
});

// ----- 回應 sidebar 查詢訊息排序順序 -----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getChatOrder") {
    const elems = document.querySelectorAll(
      '[data-message-author-role="user"][data-message-id], [data-message-author-role="assistant"][data-message-id]'
    );
    const order = Array.from(elems).map((el) => el.dataset.messageId);
    sendResponse({ order });
  }
});

// ----- 滾動到最上/最下功能 -----
chrome.runtime.onMessage.addListener((message) => {
  const chatContainer = document.querySelector("main div[class*='overflow-y']");
  if (!chatContainer) return;

  if (message.type === "scroll-to-top") {
    chatContainer.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (message.type === "scroll-to-bottom") {
    chatContainer.scrollTo({
      top: chatContainer.scrollHeight,
      behavior: "smooth",
    });
  }
});

// ----- 監聽當前聊天室的書籤資料變化（local + sync）並刷新圖示 -----
(function bindBookmarkWatcher() {
  let currentKey = getCurrentChatKey();
  if (!currentKey) return;

  // 初次綁定監聽器
  onKeyStorageChanged(currentKey, () => {
    if (getCurrentChatKey() !== currentKey) return;
    if (typeof refreshBookmarkIcons === "function") {
      refreshBookmarkIcons();
    }
  });

  // --- 針對 SPA（單頁應用）聊天室切換的處理 ---
  const _pushState = history.pushState;
  history.pushState = function (...args) {
    const ret = _pushState.apply(this, args);
    const nextKey = getCurrentChatKey();
    if (nextKey && nextKey !== currentKey) {
      currentKey = nextKey;
      onKeyStorageChanged(currentKey, () => {
        if (getCurrentChatKey() !== currentKey) return;
        if (typeof refreshBookmarkIcons === "function") {
          refreshBookmarkIcons();
        }
      });
    }
    return ret;
  };

  // 監聽瀏覽器的返回/前進（popstate 事件）
  window.addEventListener("popstate", () => {
    const nextKey = getCurrentChatKey();
    if (nextKey && nextKey !== currentKey) {
      currentKey = nextKey;
      onKeyStorageChanged(currentKey, () => {
        if (getCurrentChatKey() !== currentKey) return;
        if (typeof refreshBookmarkIcons === "function") {
          refreshBookmarkIcons();
        }
      });
    }
  });
})();

// 啟動後告訴 sidebar 已準備好
chrome.runtime.sendMessage({ type: "chatgpt-ready" });
