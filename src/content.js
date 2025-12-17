(() => {
  "use strict";

  console.log("ChatGPT Bookmark 插件已載入！");

  // ===== 全域設定 =====
  const CONFIG = {
    // Enter 雙擊判定延遲（毫秒）
    DOUBLE_CLICK_DELAY: 200,
    // 動態載入掃描週期（毫秒）
    SCAN_INTERVAL: 2000,

    // 書籤 icon
    EMPTY_ICON: "assets/icons/bookmarks.svg",
    FILL_ICON: "assets/icons/bookmarks-fill.svg",

    // 捲動定位時的 top padding，避免貼到容器最頂
    SCROLL_TOP_PADDING: 8,

    // 注入書籤按鈕重試次數/間隔
    INJECT_RETRY_TIMES: 5,
    INJECT_RETRY_INTERVAL: 120,

    // highlight 動畫時序（毫秒）
    HIGHLIGHT_FADE_DELAY: 1500,
    HIGHLIGHT_CLEAR_DELAY: 3000,
  };

  // ===== Enter 行為：僅在「編輯模式」下，Enter 單擊換行 / 雙擊送出 =====
  let enterPressCount = 0; // Enter 次數計數
  let enterPressTimer = null; // Enter 計時器

  // 重置 Enter 計數狀態
  function resetEnterState() {
    enterPressCount = 0;
    if (enterPressTimer) {
      clearTimeout(enterPressTimer);
      enterPressTimer = null;
    }
  }

  // 判斷目前事件目標是否為 ChatGPT 的輸入框
  function isChatInput(target) {
    if (!target) return false;
    if (target.tagName === "TEXTAREA") return true;
    if (target.role === "textbox" && target.dataset.testid === "text-input")
      return true;
    if (target.classList && target.classList.contains("grow-wrap")) return true;
    if (
      target.matches &&
      target.matches("div.flex-grow.relative > div > textarea")
    )
      return true;
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
    button = document.querySelector("button.btn.relative.btn-primary");
    if (button) return button;
    button = document.querySelector('button[aria-label="Send message"]');
    if (button) return button;
    button = document.querySelector('button[aria-label="Send"]');
    if (button) return button;
    // 最後掃描所有 button 找文字包含「傳送」或「Save & Submit」
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
      if (
        btn.textContent &&
        (btn.textContent.includes("傳送") ||
          btn.textContent.includes("Save & Submit"))
      ) {
        return btn;
      }
    }
    return null;
  }

  // 在指定輸入框插入換行符
  function insertNewline(targetElement) {
    if (!targetElement) return;

    const start = targetElement.selectionStart;
    const end = targetElement.selectionEnd;
    const text = targetElement.value || "";

    targetElement.value = text.substring(0, start) + "\n" + text.substring(end);
    targetElement.selectionStart = targetElement.selectionEnd = start + 1;
    const event = new Event("input", { bubbles: true });
    targetElement.dispatchEvent(event);
  }

  // 全域 keydown：處理 Shift+Enter 換行 + 編輯模式 Enter 單/雙擊
  function handleKeyDown(event) {
    const target = event.target;

    // 不是輸入框：清狀態即可
    if (!isChatInput(target)) {
      resetEnterState();
      return;
    }

    // Shift+Enter：一律換行
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      insertNewline(target);
      resetEnterState();
      return;
    }

    // 非編輯模式：不做 Enter 單/雙擊判斷（回復預設行為）
    if (!isEditingMode()) {
      resetEnterState();
      return;
    }

    // 編輯模式下：Enter（且非輸入法組字狀態）才介入
    if (event.key !== "Enter" || event.isComposing) return;

    event.preventDefault();
    enterPressCount += 1;

    // 第一次 Enter：開 timer，時間到仍是 1 次 => 換行
    if (enterPressCount === 1) {
      enterPressTimer = setTimeout(() => {
        if (enterPressCount === 1) {
          console.log("ChatGPT：編輯模式 - 單擊Enter（換行）。");
          insertNewline(target);
        }
        resetEnterState();
      }, CONFIG.DOUBLE_CLICK_DELAY);
      return;
    }

    // 第二次 Enter（在延遲時間內）：發送
    if (enterPressCount === 2) {
      if (enterPressTimer) clearTimeout(enterPressTimer);

      resetEnterState();

      const sendButton = findSendButton();
      if (sendButton) {
        sendButton.click();
        console.log("ChatGPT：編輯模式 - 雙擊Enter（發送）。");
      } else {
        console.warn("ChatGPT：編輯模式 - 未找到發送按鈕。請檢查插件。");
      }
    }
  }

  // 綁定鍵盤事件
  document.addEventListener("keydown", handleKeyDown);

  // ===== Scroll Helpers：可靠取得 ChatGPT 主捲動容器 =====
  //判斷元素是否為「真正可滾動」的容器
  function isScrollableY(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const canScrollByStyle = overflowY === "auto" || overflowY === "scroll";
    const canScrollBySize = el.scrollHeight > el.clientHeight + 5;
    return canScrollByStyle && canScrollBySize;
  }

  // 從某節點開始往父層找
  function findNearestScrollableAncestor(startEl) {
    let el = startEl;

    while (el && el !== document.body && el !== document.documentElement) {
      if (isScrollableY(el)) return el;
      el = el.parentElement;
    }

    return document.scrollingElement || document.documentElement;
  }

  // 取得「聊天室主要捲動容器」
  function getChatScrollContainer() {
    const bottom =
      document.getElementById("thread-bottom-container") ||
      document.getElementById("thread-bottom");

    if (bottom) return findNearestScrollableAncestor(bottom);

    const anyMsg = document.querySelector("[data-message-id]");
    if (anyMsg) return findNearestScrollableAncestor(anyMsg);

    const main = document.querySelector("main");
    if (main) {
      const candidates = Array.from(main.querySelectorAll("*")).filter(
        isScrollableY
      );
      if (candidates.length) {
        candidates.sort((a, b) => b.clientHeight - a.clientHeight);
        return candidates[0];
      }
    }

    return document.scrollingElement || document.documentElement;
  }

  // ===== 書籤資料：key 規則、搬家(migration)、讀寫、toggle 邏輯 =====
  // 將任意 /g/.../c/<chatId> 或 /c/<chatId>/ 統一為 /c/<chatId></chatId>
  function normalizePath(p) {
    const path = (p || "").replace(/\/$/, "");
    const m = path.match(/^\/g\/[^/]+\/c\/([^/]+)$/);
    if (m) return `/c/${m[1]}`;
    return path;
  }

  // 回傳目前聊天室的 storage key（或 null）
  function getCurrentChatKey() {
    const p = normalizePath(window.location.pathname);
    if (p === "/c" || /^\/g\/[^/]+\/c$/.test(window.location.pathname))
      return null;
    return p;
  }

  // 舊 sync 分片一次性搬家：把 /g/.../c/<id>::* → /c/<id>::*
  async function migrateSyncPrefixes() {
    const all = await chrome.storage.sync.get(null);
    const updates = {};
    const toRemove = [];
    const groups = new Map();

    // 蒐集所有舊前綴群組
    for (const k of Object.keys(all)) {
      const m = k.match(/^(\/g\/[^/]+\/c\/[^/:]+)::(idx|\d+)$/);
      if (!m) continue;

      const oldPrefix = m[1];
      const newPrefix = oldPrefix.replace(/^\/g\/[^/]+\/c\//, "/c/");

      if (!groups.has(oldPrefix)) groups.set(oldPrefix, { newPrefix });
    }

    // 依據舊 idx 搬 shard，重建新 idx
    for (const [oldPrefix, { newPrefix }] of groups) {
      const oldIdxKey = `${oldPrefix}::idx`;
      const oldIdx = Array.isArray(all[oldIdxKey]) ? all[oldIdxKey] : [];
      const newIdxKey = `${newPrefix}::idx`;

      for (const i of oldIdx) {
        const oldShardKey = `${oldPrefix}::${i}`;
        const newShardKey = `${newPrefix}::${i}`;
        if (all[oldShardKey]) {
          updates[newShardKey] = all[oldShardKey];
          toRemove.push(oldShardKey);
        }
      }

      updates[newIdxKey] = oldIdx.slice();
      toRemove.push(oldIdxKey);
    }

    if (Object.keys(updates).length) {
      await chrome.storage.sync.set(updates);
      await chrome.storage.sync.remove(toRemove);
    }
  }

  // 舊 local 一次性搬家：把 /g/.../c/<id> → /c/<id>
  function migrateLocalPrefixes() {
    chrome.storage.local.get(null, (all) => {
      Object.entries(all).forEach(([k, v]) => {
        const m = k.match(/^\/g\/[^/]+\/c\/([^/]+)\/?$/);
        if (!m) return;

        const target = `/c/${m[1]}`;
        if (target in all) return;

        chrome.storage.local.set({ [target]: v }, () =>
          chrome.storage.local.remove(k)
        );
      });
    });
  }

  // 讀取當前聊天室書籤（若不在聊天室頁面則回傳空陣列）
  function fetchBookmarks(cb) {
    const key = getCurrentChatKey();
    if (!key) return cb([]);
    dualRead(key).then((list) => cb(list));
  }

  // 儲存當前聊天室書籤（若不在聊天室頁面則直接忽略）
  function saveBookmarks(list) {
    const key = getCurrentChatKey();
    if (!key) return;
    dualSet(key, list);
  }

  // 判斷某訊息 id 是否已書籤（且未 deleted）
  function isBookmarked(id, list) {
    return list.some((it) => it.id === id && !it.deleted);
  }

  // 切換書籤：已存在：切換 deleted 墓碑, 不存在：新增一筆
  function toggleBookmark(id, content, role, cb) {
    const key = getCurrentChatKey();
    if (!key) return;

    dualRead(key).then((list) => {
      const now = Date.now();
      const idx = list.findIndex((it) => it.id === id);

      let updated = list;

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
      if (cb) cb(updated);
    });
  }

  // ===== UI：書籤按鈕注入、icon 主題、掃描與觀察器 =====
  // 根據主題回傳 hover 背景色
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

  // 建立書籤按鈕並綁定事件
  function createBookmarkButton(msg) {
    const id = msg?.dataset?.messageId;
    if (!id) return null;

    // 已存在同 id 按鈕就不再建立（避免重複）
    if (
      document.querySelector(`.chatgpt-bookmark-btn[data-bookmark-id="${id}"]`)
    ) {
      return null;
    }

    // 按鈕本體
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

    // icon
    const icon = document.createElement("img");
    Object.assign(icon.style, {
      width: "16px",
      height: "16px",
      pointerEvents: "none",
      filter: getIconFilter(),
    });
    btn.appendChild(icon);

    // 初始化 icon 狀態
    const key = getCurrentChatKey();
    if (key) {
      dualRead(key).then((list) => {
        const file = isBookmarked(id, list)
          ? CONFIG.FILL_ICON
          : CONFIG.EMPTY_ICON;
        icon.src = chrome.runtime.getURL(file);
      });
    }

    // 點擊切換書籤
    btn.addEventListener("click", () => {
      const content = (msg.innerText || "").trim();
      const role = msg.dataset.messageAuthorRole || "unknown";
      toggleBookmark(id, content, role, (updated) => {
        const file = isBookmarked(id, updated)
          ? CONFIG.FILL_ICON
          : CONFIG.EMPTY_ICON;
        icon.src = chrome.runtime.getURL(file);
      });
    });

    // hover
    btn.addEventListener("mouseenter", () => {
      btn.style.backgroundColor = getHoverBgColor();
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.backgroundColor = "transparent";
    });

    return btn;
  }

  // 嘗試注入書籤按鈕（避免 ChatGPT DOM 還沒掛載好）
  const scheduledInjects = new Map();

  function tryInjectButton(msg) {
    const id = msg?.dataset?.messageId;
    if (!id) return;

    const insertNow = () => {
      if (
        document.querySelector(
          `.chatgpt-bookmark-btn[data-bookmark-id="${id}"]`
        )
      ) {
        return true;
      }
      const curMsg =
        document.querySelector(`[data-message-id="${CSS.escape(id)}"]`) || msg;
      const turn = curMsg?.closest("article");
      if (!turn) return false;
      const copyBtn = turn.querySelector(
        '[data-testid="copy-turn-action-button"]'
      );
      if (!copyBtn || !copyBtn.parentNode) return false;
      const btn = createBookmarkButton(curMsg);
      if (!btn) return true;
      copyBtn.parentNode.insertBefore(btn, copyBtn);
      return true;
    };

    if (insertNow()) return;

    // 避免同 id 重複排程
    if (scheduledInjects.has(id)) return;

    let attempts = CONFIG.INJECT_RETRY_TIMES;
    const intervalId = setInterval(() => {
      if (insertNow() || --attempts === 0) {
        clearInterval(intervalId);
        scheduledInjects.delete(id);
      }
    }, CONFIG.INJECT_RETRY_INTERVAL);

    scheduledInjects.set(id, intervalId);
  }
  // 為目前頁面所有已渲染訊息注入書籤按鈕
  function injectExistingBookmarks() {
    document
      .querySelectorAll("[data-message-id]")
      .forEach((msg) => tryInjectButton(msg));
  }

  // 監聽新 turn / 新訊息加入，自動注入書籤按鈕
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

          if (msgNode) tryInjectButton(msgNode);
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

  // 主題切換時，更新所有書籤 icon filter
  function updateBookmarkIconsFilter() {
    const filter = getIconFilter();
    document.querySelectorAll(".chatgpt-bookmark-btn img").forEach((icon) => {
      icon.style.filter = filter;
    });
  }

  // 監聽 <html> class 變化（dark / light 切換）
  function observeThemeChange() {
    const observer = new MutationObserver(() => updateBookmarkIconsFilter());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  // 依據 storage 的書籤資料刷新所有 icon（空心/實心）
  function refreshBookmarkIcons() {
    const key = getCurrentChatKey();
    if (!key) return;
    dualRead(key).then((list) => {
      document.querySelectorAll(".chatgpt-bookmark-btn").forEach((btn) => {
        const id = btn.dataset.bookmarkId;
        const icon = btn.firstElementChild;
        const file = isBookmarked(id, list)
          ? CONFIG.FILL_ICON
          : CONFIG.EMPTY_ICON;
        if (icon) icon.src = chrome.runtime.getURL(file);
      });
    });
  }

  // ==== Highlight：滾動到訊息時的高亮動畫 =====
  function injectHighlightStyle() {
    if (document.getElementById("gptmark-highlight-style")) return;
    const style = document.createElement("style");
    style.id = "gptmark-highlight-style";
    style.textContent = `
      .gptmark-highlight {
        position: relative;
        outline: 2px solid rgba(0, 89, 255, 0.9);
        outline-offset: 0px;
        background-color: rgba(138, 161, 229, 0.25);
        transition: outline-color 1s ease, background-color 1s ease, box-shadow 1s ease;
      }
      .gptmark-highlight.fadeout {
        outline-color: transparent;
        background-color: transparent;
        box-shadow: none;
      }
    `;
    document.head.appendChild(style);
  }

  const highlightTimers = new WeakMap();

  // 對指定訊息做 highlight（可重複觸發，會先清掉前一次 timer）
  function highlightMessage(msgElem) {
    const timers = highlightTimers.get(msgElem);
    if (timers) {
      clearTimeout(timers.fadeTimer);
      clearTimeout(timers.clearTimer);
    }

    msgElem.classList.remove("gptmark-highlight", "fadeout");
    msgElem.offsetWidth;
    msgElem.classList.add("gptmark-highlight");
    const fadeTimer = setTimeout(() => {
      msgElem.classList.add("fadeout");
    }, CONFIG.HIGHLIGHT_FADE_DELAY);

    const clearTimer = setTimeout(() => {
      msgElem.classList.remove("gptmark-highlight", "fadeout");
    }, CONFIG.HIGHLIGHT_CLEAR_DELAY);

    highlightTimers.set(msgElem, { fadeTimer, clearTimer });
  }

  // ===== 路由變化：SPA 下聊天室切換，需要重新注入/刷新 icon/重新綁定 watcher =====
  const ROUTE_EVENT = "gptmark-location-change";
  let lastPathname = window.location.pathname;

  function dispatchRouteChange() {
    window.dispatchEvent(new Event(ROUTE_EVENT));
  }

  function patchHistoryOnce() {
    const H = history;
    ["pushState", "replaceState"].forEach((type) => {
      const orig = H[type];
      if (orig.__gptmark_patched__) return;

      const patched = function (...args) {
        const ret = orig.apply(this, args);
        dispatchRouteChange();
        return ret;
      };

      patched.__gptmark_patched__ = true;
      H[type] = patched;
    });
  }

  function handleLocationChange() {
    if (window.location.pathname === lastPathname) return;
    lastPathname = window.location.pathname;

    setTimeout(() => {
      injectExistingBookmarks();
      refreshBookmarkIcons();
    }, 600);
  }

  // ===== runtime messages：sidebar -> content 的控制入口 =====
  // 滾動到指定訊息（並高亮）
  function scrollToMessageId(messageId) {
    const msgElem = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!msgElem) return { ok: false, reason: "not-found" };

    const chatContainer = getChatScrollContainer();

    if (chatContainer) {
      // 以容器座標計算相對位置，確保捲的是對的容器
      const containerRect = chatContainer.getBoundingClientRect();
      const msgRect = msgElem.getBoundingClientRect();
      const curTop = chatContainer.scrollTop;

      const alignTop = curTop + (msgRect.top - containerRect.top);
      const maxScroll = chatContainer.scrollHeight - chatContainer.clientHeight;

      const targetTop = Math.max(
        0,
        Math.min(alignTop - CONFIG.SCROLL_TOP_PADDING, maxScroll)
      );

      chatContainer.scrollTo({ top: targetTop, behavior: "smooth" });
    } else {
      // fallback：如果真的抓不到容器，就用原生 scrollIntoView
      msgElem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    highlightMessage(msgElem);
    return { ok: true };
  }

  // 回傳聊天室訊息順序給 sidebar 用
  function getChatOrder() {
    const elems = document.querySelectorAll(
      '[data-message-author-role="user"][data-message-id], [data-message-author-role="assistant"][data-message-id]'
    );
    return Array.from(elems).map((el) => el.dataset.messageId);
  }

  // 捲動到最上/最下
  function scrollToEdge(edgeType) {
    const chatContainer = getChatScrollContainer();
    if (!chatContainer) return false;

    if (edgeType === "top") {
      chatContainer.scrollTo({ top: 0, behavior: "smooth" });
      return true;
    }

    if (edgeType === "bottom") {
      chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: "smooth",
      });
      return true;
    }
    return false;
  }

  // 統一 runtime message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    // 滾動到書籤訊息
    if (message.type === "scrollToMessage") {
      const ret = scrollToMessageId(message.id);
      sendResponse?.({ result: ret.ok ? "scrolled" : ret.reason });
      return;
    }

    // sidebar 取得訊息排序
    if (message.type === "getChatOrder") {
      sendResponse?.({ order: getChatOrder() });
      return;
    }

    // 滾動到頂/底
    if (message.type === "scroll-to-top") {
      scrollToEdge("top");
      return;
    }
    if (message.type === "scroll-to-bottom") {
      scrollToEdge("bottom");
      return;
    }
  });

  // ===== storage watcher：監聽當前聊天室 key 的書籤變動，自動刷新 icon =====
  function bindBookmarkWatcher() {
    let currentKey = getCurrentChatKey();
    if (!currentKey) return;

    // 初次綁定
    onKeyStorageChanged(currentKey, () => {
      if (getCurrentChatKey() !== currentKey) return;
      refreshBookmarkIcons();
    });

    // 路由改變：重新綁定新 key（避免聊天室切換後不更新）
    window.addEventListener(ROUTE_EVENT, () => {
      const nextKey = getCurrentChatKey();
      if (!nextKey || nextKey === currentKey) return;
      currentKey = nextKey;
      onKeyStorageChanged(currentKey, () => {
        if (getCurrentChatKey() !== currentKey) return;
        refreshBookmarkIcons();
      });
    });
  }

  // ===== 初始化：migration、style、observer、定期掃描、路由監聽、ready 訊息 =====
  async function init() {
    // 1) migration（一次性）
    migrateLocalPrefixes();
    await migrateSyncPrefixes();

    // 2) highlight style
    injectHighlightStyle();

    // 3) 先注入一次 + 監聽後續新增
    injectExistingBookmarks();
    observeAllTurns();

    // 4) 主題切換 icon filter
    observeThemeChange();

    // 5) 定期掃描（防止 ChatGPT 懶載入時漏掉）
    setInterval(injectExistingBookmarks, CONFIG.SCAN_INTERVAL);

    // 6) 路由監聽（SPA）
    patchHistoryOnce();
    window.addEventListener(ROUTE_EVENT, handleLocationChange);
    window.addEventListener("popstate", () => {
      dispatchRouteChange();
      handleLocationChange();
    });

    // 7) storage watcher（跟著路由切換 key）
    bindBookmarkWatcher();

    // 8) 告訴 sidebar：content script 已準備好
    chrome.runtime.sendMessage({ type: "chatgpt-ready" });
  }

  // 等頁面載入後再 init（與你原本流程一致）
  window.addEventListener("load", () => {
    init().catch((err) => console.error("[GPT-mark] init failed:", err));
  });
})();
