(() => {
  "use strict";

  console.log("ChatGPT Bookmark 插件已載入！");

  // ===== 全域設定 =====
  const CONFIG = {
    // Enter double-click 判定視窗，單位 ms
    DOUBLE_CLICK_DELAY: 200,
    // DOM 懶載入補掃描間隔，單位 ms
    SCAN_INTERVAL: 2000,

    // Bookmark icon 的 resource path
    EMPTY_ICON: self.GPT_MARK.ICONS.BOOKMARK_EMPTY,
    FILL_ICON: self.GPT_MARK.ICONS.BOOKMARK_FILLED,

    // Scroll target 頂部預留距離，避免訊息貼齊容器上緣
    SCROLL_TOP_PADDING: 60,
    // Bookmark 目標可能因 ChatGPT 虛擬列表尚未渲染，需先分段捲動尋找
    SCROLL_FIND_TIMEOUT: 25000,
    SCROLL_FIND_STEP_DELAY: 480,
    SCROLL_FIND_IDLE_LIMIT: 4,
    SCROLL_VERIFY_INITIAL_DELAY: 520,
    SCROLL_VERIFY_INTERVAL: 220,
    SCROLL_VERIFY_TIMEOUT: 2200,
    SCROLL_TARGET_TOLERANCE: 32,

    // Bookmark button 注入重試上限與間隔
    INJECT_RETRY_TIMES: 5,
    INJECT_RETRY_INTERVAL: 120,

    // Highlight animation 時序，單位 ms
    HIGHLIGHT_FADE_DELAY: 1500,
    HIGHLIGHT_CLEAR_DELAY: 3000,
  };
  const { MESSAGE_TYPES, getChatKeyFromPathname } = self.GPT_MARK;

  // ===== Enter 編輯模式快捷鍵 =====
  let enterPressCount = 0; // 目前 Enter 連擊次數
  let enterPressTimer = null; // 單擊換行的延遲 timer

  // 清除 Enter 連擊狀態與 timer
  function resetEnterState() {
    enterPressCount = 0;
    if (enterPressTimer) {
      clearTimeout(enterPressTimer);
      enterPressTimer = null;
    }
  }

  // 判斷事件來源是否為 ChatGPT message input
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

  // 判斷目前是否位於 ChatGPT 回覆編輯模式
  function isEditingMode() {
    const editSendButton = document.querySelector(
      "button.btn.relative.btn-primary"
    );
    return !!editSendButton;
  }

  // 依 ChatGPT DOM 版本差異尋找 submit button
  function findSendButton() {
    // 優先使用穩定的 data-testid selector
    let button = document.querySelector('[data-testid="send-button"]');
    if (button) return button;
    button = document.querySelector("button.btn.relative.btn-primary");
    if (button) return button;
    button = document.querySelector('button[aria-label="Send message"]');
    if (button) return button;
    button = document.querySelector('button[aria-label="Send"]');
    if (button) return button;
    // selector 失效時以 button text 作最後 fallback
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

  // 在 textarea 游標位置插入 newline，並派送 input event
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

  // 處理 Shift+Enter 與編輯模式下的 Enter single/double click
  function handleKeyDown(event) {
    const target = event.target;

    // 非 ChatGPT input 時清除暫存狀態
    if (!isChatInput(target)) {
      resetEnterState();
      return;
    }

    // Shift+Enter 固定保留為換行
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      insertNewline(target);
      resetEnterState();
      return;
    }

    // 一般對話模式交回 ChatGPT 原生 Enter 行為
    if (!isEditingMode()) {
      resetEnterState();
      return;
    }

    // 僅攔截編輯模式中的 Enter，IME composing 期間不處理
    if (event.key !== "Enter" || event.isComposing) return;

    event.preventDefault();
    enterPressCount += 1;

    // 第一次 Enter 等待 double-click 視窗，逾時後插入 newline
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

    // 第二次 Enter 視為提交編輯內容
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

  // 註冊全域 keydown listener
  document.addEventListener("keydown", handleKeyDown);

  // ===== Scroll helper 捲動輔助 =====
  // 判斷元素是否可垂直 scroll
  function isScrollableY(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const canScrollByStyle = overflowY === "auto" || overflowY === "scroll";
    const canScrollBySize = el.scrollHeight > el.clientHeight + 5;
    return canScrollByStyle && canScrollBySize;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeScrollContainer(container) {
    if (
      container === document.body ||
      container === document.documentElement ||
      container === window
    ) {
      return document.scrollingElement || document.documentElement;
    }
    return container || document.scrollingElement || document.documentElement;
  }

  function isDocumentScrollContainer(container) {
    const normalized = normalizeScrollContainer(container);
    return (
      normalized === document.scrollingElement ||
      normalized === document.documentElement ||
      normalized === document.body
    );
  }

  function getScrollTop(container) {
    const normalized = normalizeScrollContainer(container);
    if (isDocumentScrollContainer(normalized)) {
      return window.scrollY || normalized.scrollTop || document.body.scrollTop;
    }
    return normalized.scrollTop;
  }

  function getScrollHeight(container) {
    const normalized = normalizeScrollContainer(container);
    if (isDocumentScrollContainer(normalized)) {
      return Math.max(
        normalized.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
    }
    return normalized.scrollHeight;
  }

  function getViewportHeight(container) {
    const normalized = normalizeScrollContainer(container);
    return isDocumentScrollContainer(normalized)
      ? window.innerHeight
      : normalized.clientHeight;
  }

  function getMaxScrollTop(container) {
    return Math.max(
      0,
      getScrollHeight(container) - getViewportHeight(container)
    );
  }

  function getScrollViewportRect(container) {
    const normalized = normalizeScrollContainer(container);
    if (isDocumentScrollContainer(normalized)) {
      return {
        top: 0,
        bottom: window.innerHeight,
        height: window.innerHeight,
      };
    }
    return normalized.getBoundingClientRect();
  }

  function scrollContainerTo(container, top, behavior = "auto") {
    const normalized = normalizeScrollContainer(container);
    if (isDocumentScrollContainer(normalized)) {
      window.scrollTo({ top, behavior });
      return;
    }
    normalized.scrollTo({ top, behavior });
  }

  // 從指定節點向上尋找最近的 scroll container
  function findNearestScrollableAncestor(startEl) {
    let el = startEl;

    while (el && el !== document.body && el !== document.documentElement) {
      if (isScrollableY(el)) return normalizeScrollContainer(el);
      el = el.parentElement;
    }

    return normalizeScrollContainer(document.scrollingElement);
  }

  // 取得 ChatGPT conversation 的主要 scroll container
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

    return normalizeScrollContainer(document.scrollingElement);
  }

  // ===== Bookmark data/storage 書籤資料 =====
  // 取得目前 conversation 的 storage key
  function getCurrentChatKey() {
    return getChatKeyFromPathname(window.location.pathname);
  }

  // 將舊版 sync shard key 從 /g/.../c/<id> migration 至 /c/<id>
  async function migrateSyncPrefixes() {
    const all = await chrome.storage.sync.get(null);
    const updates = {};
    const toRemove = [];
    const groups = new Map();

    // 依舊 prefix 蒐集 shard group
    for (const k of Object.keys(all)) {
      const m = k.match(/^(\/g\/[^/]+\/c\/[^/:]+)::(idx|\d+)$/);
      if (!m) continue;

      const oldPrefix = m[1];
      const newPrefix = oldPrefix.replace(/^\/g\/[^/]+\/c\//, "/c/");

      if (!groups.has(oldPrefix)) groups.set(oldPrefix, { newPrefix });
    }

    // 依舊 index 搬移 shard，並建立新 index
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

  // 將舊版 local key 從 /g/.../c/<id> migration 至 /c/<id>
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

  // 儲存目前 conversation 的 bookmark list；非 conversation 頁面直接略過
  function saveBookmarks(list) {
    const key = getCurrentChatKey();
    if (!key) return;
    dualSet(key, list);
  }

  // 確認 message id 是否存在有效 bookmark
  function isBookmarked(id, list) {
    return list.some((it) => it.id === id && !it.deleted);
  }

  // 切換 bookmark 狀態；刪除採用 tombstone 以支援 sync merge
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

  // ===== Bookmark button UI 書籤按鈕 =====
  // 依 theme 回傳 hover 背景色
  function getHoverBgColor() {
    return document.documentElement.classList.contains("dark")
      ? "#303030"
      : "#E8E8E8";
  }

  // 依 theme 回傳 icon filter
  function getIconFilter() {
    return document.documentElement.classList.contains("dark")
      ? "brightness(0) invert(1)"
      : "brightness(0)";
  }

  const CHAT_SURFACE_COLOR_VARS = [
    "--main-surface-primary",
    "--bg-primary",
    "--background-primary",
    "--surface-primary",
  ];
  const CHAT_TEXT_COLOR_VARS = [
    "--text-primary",
    "--text-color",
    "--foreground",
  ];

  function isTransparentColor(color) {
    return (
      !color ||
      color === "transparent" ||
      color === "rgba(0, 0, 0, 0)" ||
      color === "rgb(0 0 0 / 0)"
    );
  }

  function normalizeCssColor(value) {
    const raw = (value || "").trim();
    if (!raw || !CSS.supports("color", raw)) return "";

    const probe = document.createElement("span");
    probe.style.color = raw;
    document.documentElement.appendChild(probe);
    const color = window.getComputedStyle(probe).color;
    probe.remove();

    return isTransparentColor(color) ? "" : color;
  }

  function getCssVarColor(names) {
    const style = window.getComputedStyle(document.documentElement);
    for (const name of names) {
      const color = normalizeCssColor(style.getPropertyValue(name));
      if (color) return color;
    }
    return "";
  }

  function getElementBackgroundColor(element) {
    let el = element;
    while (el && el instanceof Element) {
      const color = window.getComputedStyle(el).backgroundColor;
      if (!isTransparentColor(color)) return color;
      el = el.parentElement;
    }
    return "";
  }

  function parseRgbColor(color) {
    const match = (color || "").match(
      /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/
    );
    if (!match) return null;
    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
    };
  }

  function isDarkColor(color) {
    const rgb = parseRgbColor(color);
    if (!rgb) return document.documentElement.classList.contains("dark");

    const toLinear = (value) => {
      const channel = value / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    };
    const luminance =
      0.2126 * toLinear(rgb.r) +
      0.7152 * toLinear(rgb.g) +
      0.0722 * toLinear(rgb.b);

    return luminance < 0.45;
  }

  function getChatThemeColors() {
    const main = document.querySelector("main, [role='main']") || document.body;
    const background =
      getCssVarColor(CHAT_SURFACE_COLOR_VARS) ||
      getElementBackgroundColor(main) ||
      getElementBackgroundColor(document.body) ||
      "#ffffff";
    const isDark = isDarkColor(background);
    const text =
      getCssVarColor(CHAT_TEXT_COLOR_VARS) ||
      normalizeCssColor(window.getComputedStyle(main).color) ||
      (isDark ? "#f3f3f3" : "#000000");

    return { background, text, isDark };
  }

  const TURN_SELECTOR =
    '[data-testid^="conversation-turn-"], section[data-turn-id], article, [data-turn-id]';
  const MESSAGE_SELECTOR = "[data-message-id]";
  const COPY_ACTION_SELECTOR = '[data-testid="copy-turn-action-button"]';

  function getTurnContainer(startNode) {
    if (!(startNode instanceof Element)) return null;
    if (startNode.matches(TURN_SELECTOR)) return startNode;
    return startNode.closest(TURN_SELECTOR);
  }

  function getTurnMessageNode(startNode) {
    const turn = getTurnContainer(startNode);
    if (!turn) return null;

    const turnId = turn.getAttribute("data-turn-id");
    if (turnId) {
      const exactMsg = turn.querySelector(
        `[data-message-id="${CSS.escape(turnId)}"]`
      );
      if (exactMsg) return exactMsg;
    }

    return turn.querySelector(MESSAGE_SELECTOR);
  }

  function getBookmarkIconNode(button) {
    return button?.querySelector("img") || null;
  }

  function setBookmarkIconSource(iconNode, isFilled) {
    if (!iconNode) return;
    const file = isFilled ? CONFIG.FILL_ICON : CONFIG.EMPTY_ICON;
    iconNode.src = chrome.runtime.getURL(file);
  }

  // 建立 bookmark button 並綁定互動
  function createBookmarkButton(msg, hostButton) {
    const id = msg?.dataset?.messageId;
    if (!id) return null;

    // 已存在同 message id 時略過，避免重複注入
    if (
      document.querySelector(
        `.chatgpt-bookmark-btn[data-bookmark-id="${CSS.escape(id)}"]`
      )
    ) {
      return null;
    }

    // 建立 button element
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chatgpt-bookmark-btn";
    btn.title = "書籤";
    btn.setAttribute("aria-label", "切換書籤");
    btn.setAttribute("data-bookmark-id", id);

    if (hostButton instanceof HTMLElement) {
      btn.className = `${hostButton.className} chatgpt-bookmark-btn`;
      btn.style.flexShrink = "0";
    } else {
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
        flexShrink: "0",
      });
    }

    const iconWrap = document.createElement("span");
    if (hostButton?.firstElementChild instanceof HTMLElement) {
      iconWrap.className = hostButton.firstElementChild.className;
    } else {
      Object.assign(iconWrap.style, {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
      });
    }

    // 建立 icon element
    const icon = document.createElement("img");
    Object.assign(icon.style, {
      width: hostButton ? "18px" : "16px",
      height: hostButton ? "18px" : "16px",
      pointerEvents: "none",
      filter: getIconFilter(),
    });
    setBookmarkIconSource(icon, false);
    iconWrap.appendChild(icon);
    btn.appendChild(iconWrap);

    // 讀取 storage 初始化 icon 狀態
    const key = getCurrentChatKey();
    if (key) {
      dualRead(key).then((list) => {
        setBookmarkIconSource(icon, isBookmarked(id, list));
      });
    }

    // 點擊後更新 bookmark 狀態與 icon
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const content = (msg.innerText || "").trim();
      const role = msg.dataset.messageAuthorRole || "unknown";
      toggleBookmark(id, content, role, (updated) => {
        setBookmarkIconSource(icon, isBookmarked(id, updated));
      });
    });

    // 沒有可沿用的 ChatGPT button class 時才補上 hover style
    if (!(hostButton instanceof HTMLElement)) {
      btn.addEventListener("mouseenter", () => {
        btn.style.backgroundColor = getHoverBgColor();
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.backgroundColor = "transparent";
      });
    }

    return btn;
  }

  // ChatGPT action row 可能延遲渲染，因此以 retry 注入 button
  const scheduledInjects = new Map();

  function tryInjectButton(msg) {
    const id = msg?.dataset?.messageId;
    if (!id) return;

    const insertNow = () => {
      if (
        document.querySelector(
          `.chatgpt-bookmark-btn[data-bookmark-id="${CSS.escape(id)}"]`
        )
      ) {
        return true;
      }
      const curMsg =
        document.querySelector(`[data-message-id="${CSS.escape(id)}"]`) || msg;
      const turn = getTurnContainer(curMsg);
      if (!turn) return false;
      const copyBtn = turn.querySelector(COPY_ACTION_SELECTOR);
      if (!copyBtn || !copyBtn.parentNode) return false;
      const btn = createBookmarkButton(curMsg, copyBtn);
      if (!btn) return true;
      copyBtn.parentNode.insertBefore(btn, copyBtn);
      return true;
    };

    if (insertNow()) return;

    // 同一 message id 只保留一個 retry job
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
  // 對目前已渲染 message 注入 bookmark button
  function injectExistingBookmarks() {
    document
      .querySelectorAll(MESSAGE_SELECTOR)
      .forEach((msg) => tryInjectButton(msg));
  }

  function handlePotentialBookmarkTarget(node) {
    if (!(node instanceof HTMLElement)) return;

    if (node.matches(COPY_ACTION_SELECTOR)) {
      const msg = getTurnMessageNode(node);
      if (msg) tryInjectButton(msg);
      return;
    }

    if (node.matches(TURN_SELECTOR)) {
      const msg = getTurnMessageNode(node);
      if (msg) tryInjectButton(msg);
      return;
    }

    const nestedCopyBtn = node.querySelector(COPY_ACTION_SELECTOR);
    if (nestedCopyBtn) {
      const msg = getTurnMessageNode(nestedCopyBtn);
      if (msg) tryInjectButton(msg);
      return;
    }

    const nestedTurn = node.querySelector(TURN_SELECTOR);
    if (nestedTurn) {
      const msg = getTurnMessageNode(nestedTurn);
      if (msg) tryInjectButton(msg);
      return;
    }

    const msgNode = node.matches(MESSAGE_SELECTOR)
      ? node
      : node.querySelector(MESSAGE_SELECTOR);

    if (msgNode) tryInjectButton(msgNode);
  }

  // MutationObserver 監聽新 turn/message，補注入 bookmark button
  function observeAllTurns() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes") {
          handlePotentialBookmarkTarget(m.target);
          continue;
        }

        for (const node of m.addedNodes) {
          handlePotentialBookmarkTarget(node);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-message-id", "data-testid", "data-turn-id"],
    });
  }

  // theme 切換時同步所有 bookmark icon filter
  function updateBookmarkIconsFilter() {
    const filter = getIconFilter();
    document.querySelectorAll(".chatgpt-bookmark-btn img").forEach((icon) => {
      icon.style.filter = filter;
    });
  }

  let themeSyncTimer = null;

  function notifyChatThemeChanged() {
    if (themeSyncTimer) clearTimeout(themeSyncTimer);
    themeSyncTimer = setTimeout(() => {
      chrome.runtime.sendMessage(
        {
          type: MESSAGE_TYPES.CHATGPT_THEME_CHANGED,
          colors: getChatThemeColors(),
        },
        () => chrome.runtime.lastError
      );
    }, 80);
  }

  // 監聽 <html> class 變化以偵測 dark/light 切換
  function observeThemeChange() {
    const observer = new MutationObserver(() => {
      updateBookmarkIconsFilter();
      notifyChatThemeChanged();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  }

  // 根據 storage 狀態同步所有 bookmark icon
  function refreshBookmarkIcons() {
    const key = getCurrentChatKey();
    if (!key) return;
    dualRead(key).then((list) => {
      document.querySelectorAll(".chatgpt-bookmark-btn").forEach((btn) => {
        const id = btn.dataset.bookmarkId;
        const icon = getBookmarkIconNode(btn);
        setBookmarkIconSource(icon, isBookmarked(id, list));
      });
    });
  }

  // ===== Highlight 動畫 =====
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
      .gptmark-highlight[data-message-author-role="assistant"] {
        outline: none;
        box-shadow: inset 0 0 0 2px rgba(0, 89, 255, 0.9);
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

  // 對 message 套用 highlight，可重複觸發並清除前次 timer
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

  function isRenderableElement(el) {
    if (!(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      el.isConnected &&
      el.getClientRects().length > 0 &&
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  }

  function findMessageElementById(messageId) {
    const selector = `[data-message-id="${CSS.escape(messageId)}"]`;
    const candidates = Array.from(document.querySelectorAll(selector));
    if (!candidates.length) return null;
    return candidates.find(isRenderableElement) || candidates[0];
  }

  function getScrollTargetForMessage(msgElem) {
    return getTurnContainer(msgElem) || msgElem;
  }

  function getScrollContainerForTarget(targetElem) {
    if (targetElem instanceof HTMLElement) {
      return findNearestScrollableAncestor(
        targetElem.parentElement || targetElem
      );
    }
    return normalizeScrollContainer(getChatScrollContainer());
  }

  function getTargetScrollTop(targetElem, container) {
    const normalized = normalizeScrollContainer(container);
    const viewportRect = getScrollViewportRect(normalized);
    const targetRect = targetElem.getBoundingClientRect();
    const curTop = getScrollTop(normalized);
    const maxScroll = getMaxScrollTop(normalized);
    const nextTop =
      curTop +
      (targetRect.top - viewportRect.top) -
      CONFIG.SCROLL_TOP_PADDING;

    return Math.max(0, Math.min(nextTop, maxScroll));
  }

  function scrollTargetIntoPosition(targetElem, behavior = "auto") {
    const container = getScrollContainerForTarget(targetElem);
    const targetTop = getTargetScrollTop(targetElem, container);
    scrollContainerTo(container, targetTop, behavior);
    return { container, targetTop };
  }

  function isScrollTargetSettled(targetElem, container) {
    const normalized = normalizeScrollContainer(container);
    const viewportRect = getScrollViewportRect(normalized);
    const targetRect = targetElem.getBoundingClientRect();
    const delta =
      targetRect.top - viewportRect.top - CONFIG.SCROLL_TOP_PADDING;
    const curTop = getScrollTop(normalized);
    const maxScroll = getMaxScrollTop(normalized);
    const visible =
      targetRect.bottom > viewportRect.top &&
      targetRect.top < viewportRect.bottom;

    if (Math.abs(delta) <= CONFIG.SCROLL_TARGET_TOLERANCE) return true;
    if (!visible) return false;

    const atTop = curTop <= CONFIG.SCROLL_TARGET_TOLERANCE;
    const atBottom = curTop >= maxScroll - CONFIG.SCROLL_TARGET_TOLERANCE;
    return (atTop && delta < 0) || (atBottom && delta > 0);
  }

  function isTargetVisible(targetElem, container) {
    const viewportRect = getScrollViewportRect(container);
    const targetRect = targetElem.getBoundingClientRect();
    return (
      targetRect.bottom > viewportRect.top &&
      targetRect.top < viewportRect.bottom
    );
  }

  function getRenderedMessageSnapshot(container) {
    const elems = Array.from(document.querySelectorAll(MESSAGE_SELECTOR));
    return {
      top: Math.round(getScrollTop(container)),
      max: Math.round(getMaxScrollTop(container)),
      height: Math.round(getScrollHeight(container)),
      count: elems.length,
      first: elems[0]?.dataset?.messageId || "",
      last: elems[elems.length - 1]?.dataset?.messageId || "",
    };
  }

  function hasScrollSnapshotChanged(a, b) {
    if (!a || !b) return true;
    return (
      Math.abs(a.top - b.top) > CONFIG.SCROLL_TARGET_TOLERANCE ||
      Math.abs(a.max - b.max) > CONFIG.SCROLL_TARGET_TOLERANCE ||
      Math.abs(a.height - b.height) > CONFIG.SCROLL_TARGET_TOLERANCE ||
      a.count !== b.count ||
      a.first !== b.first ||
      a.last !== b.last
    );
  }

  async function verifyScrollTarget(messageId, requestId) {
    const startTime = performance.now();
    let correctionCount = 0;

    while (performance.now() - startTime < CONFIG.SCROLL_VERIFY_TIMEOUT) {
      if (requestId !== activeScrollRequestId) {
        return { ok: false, reason: "cancelled" };
      }

      const msgElem = findMessageElementById(messageId);
      if (!msgElem) {
        await delay(CONFIG.SCROLL_VERIFY_INTERVAL);
        continue;
      }

      const targetElem = getScrollTargetForMessage(msgElem);
      const container = getScrollContainerForTarget(targetElem);

      if (isScrollTargetSettled(targetElem, container)) {
        return { ok: true };
      }

      const correctionBehavior =
        correctionCount === 0 && isTargetVisible(targetElem, container)
          ? "smooth"
          : "auto";
      correctionCount += 1;
      scrollTargetIntoPosition(targetElem, correctionBehavior);
      await delay(
        correctionBehavior === "smooth"
          ? CONFIG.SCROLL_VERIFY_INITIAL_DELAY
          : CONFIG.SCROLL_VERIFY_INTERVAL
      );
    }

    const msgElem = findMessageElementById(messageId);
    if (!msgElem) return { ok: false, reason: "not-found" };
    return { ok: true, reason: "best-effort" };
  }

  async function scanForMessage(messageId, direction, requestId, deadline) {
    const container = normalizeScrollContainer(getChatScrollContainer());
    const step = Math.max(getViewportHeight(container) * 0.8, 420);
    let idleCount = 0;
    let previous = getRenderedMessageSnapshot(container);

    while (performance.now() < deadline) {
      if (requestId !== activeScrollRequestId) return null;

      const msgElem = findMessageElementById(messageId);
      if (msgElem) return msgElem;

      const curTop = getScrollTop(container);
      const maxScroll = getMaxScrollTop(container);
      const nextTop =
        direction === "up"
          ? Math.max(0, curTop - step)
          : Math.min(maxScroll, curTop + step);

      scrollContainerTo(container, nextTop, "smooth");
      await delay(CONFIG.SCROLL_FIND_STEP_DELAY);

      const nextMsgElem = findMessageElementById(messageId);
      if (nextMsgElem) return nextMsgElem;

      const current = getRenderedMessageSnapshot(container);
      const changed = hasScrollSnapshotChanged(previous, current);
      const atEdge =
        direction === "up"
          ? current.top <= CONFIG.SCROLL_TARGET_TOLERANCE
          : current.top >= current.max - CONFIG.SCROLL_TARGET_TOLERANCE;

      idleCount = atEdge && !changed ? idleCount + 1 : 0;
      if (idleCount >= CONFIG.SCROLL_FIND_IDLE_LIMIT) return null;

      previous = current;
    }

    return null;
  }

  async function loadMessageIntoDom(messageId, requestId) {
    let msgElem = findMessageElementById(messageId);
    if (msgElem) return msgElem;

    const container = normalizeScrollContainer(getChatScrollContainer());
    const initialTop = getScrollTop(container);
    const maxScroll = getMaxScrollTop(container);
    const progress = maxScroll > 0 ? initialTop / maxScroll : 1;
    const directions = progress < 0.2 ? ["down", "up"] : ["up", "down"];
    const deadline = performance.now() + CONFIG.SCROLL_FIND_TIMEOUT;

    for (const direction of directions) {
      msgElem = await scanForMessage(
        messageId,
        direction,
        requestId,
        deadline
      );
      if (msgElem) return msgElem;

      if (performance.now() >= deadline) break;
      scrollContainerTo(container, initialTop, "auto");
      await delay(CONFIG.SCROLL_FIND_STEP_DELAY);
    }

    scrollContainerTo(container, initialTop, "auto");
    return null;
  }

  // ===== SPA route 監聽 =====
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
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.CHATGPT_ROUTE_CHANGED,
      pathname: lastPathname,
    });

    setTimeout(() => {
      injectExistingBookmarks();
      refreshBookmarkIcons();
    }, 600);
  }

  // ===== Runtime message 入口 =====
  let activeScrollRequestId = 0;

  // sidebar 要求定位到指定 message
  async function scrollToMessageId(messageId) {
    const requestId = ++activeScrollRequestId;
    const msgElem = await loadMessageIntoDom(messageId, requestId);

    if (!msgElem) return { ok: false, reason: "not-found" };
    if (requestId !== activeScrollRequestId) {
      return { ok: false, reason: "cancelled" };
    }

    const targetElem = getScrollTargetForMessage(msgElem);
    scrollTargetIntoPosition(targetElem, "smooth");

    await delay(CONFIG.SCROLL_VERIFY_INITIAL_DELAY);
    const ret = await verifyScrollTarget(messageId, requestId);
    const finalMsgElem = ret.ok ? findMessageElementById(messageId) : null;
    if (finalMsgElem && requestId === activeScrollRequestId) {
      highlightMessage(finalMsgElem);
    }
    return ret;
  }

  // 回傳目前 DOM 中的 conversation message order
  function getChatOrder() {
    const elems = document.querySelectorAll(
      '[data-message-author-role="user"][data-message-id], [data-message-author-role="assistant"][data-message-id]'
    );
    return Array.from(elems).map((el) => el.dataset.messageId);
  }

  // 統一處理 sidebar/content runtime message
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    // 定位 bookmark message
    if (message.type === MESSAGE_TYPES.SCROLL_TO_MESSAGE) {
      scrollToMessageId(message.id).then((ret) => {
        sendResponse?.({ result: ret.ok ? "scrolled" : ret.reason });
      });
      return true;
    }

    // 提供 sidebar 排序所需的 message order
    if (message.type === MESSAGE_TYPES.GET_CHAT_ORDER) {
      sendResponse?.({ order: getChatOrder() });
      return;
    }

    // 提供 sidebar 同步 ChatGPT 實際背景色
    if (message.type === MESSAGE_TYPES.GET_CHAT_THEME_COLORS) {
      sendResponse?.({ colors: getChatThemeColors() });
      return;
    }

    // sidebar 刪除 bookmark 後，主動刷新頁面上的 bookmark icon
    if (message.type === MESSAGE_TYPES.REFRESH_BOOKMARK_ICONS) {
      refreshBookmarkIcons();
      return;
    }
  });

  // ===== Storage watcher 監聽 =====
  function bindBookmarkWatcher() {
    let currentKey = null;
    let unbindStorageWatcher = null;

    const bindToKey = (nextKey) => {
      if (nextKey === currentKey) return;

      if (unbindStorageWatcher) {
        unbindStorageWatcher();
        unbindStorageWatcher = null;
      }

      currentKey = nextKey;
      if (!currentKey) return;

      const watchedKey = currentKey;
      unbindStorageWatcher = onKeyStorageChanged(watchedKey, () => {
        if (getCurrentChatKey() !== watchedKey) return;
        refreshBookmarkIcons();
      });
    };

    // 初次綁定目前 conversation key
    bindToKey(getCurrentChatKey());

    // route change 時切換 watcher，避免跨 conversation 更新
    window.addEventListener(ROUTE_EVENT, () => {
      bindToKey(getCurrentChatKey());
    });
  }

  // ===== 初始化流程 =====
  async function init() {
    // 執行 storage migration
    migrateLocalPrefixes();
    await migrateSyncPrefixes();

    // 注入 highlight style
    injectHighlightStyle();

    // 初次注入 bookmark button，並監聽後續 DOM 變化
    injectExistingBookmarks();
    observeAllTurns();

    // 監聽 theme 切換並同步 icon filter
    observeThemeChange();

    // 定期補掃描，處理 ChatGPT lazy render 漏網節點
    setInterval(injectExistingBookmarks, CONFIG.SCAN_INTERVAL);

    // 監聽 SPA route change
    patchHistoryOnce();
    window.addEventListener(ROUTE_EVENT, handleLocationChange);
    window.addEventListener("popstate", () => {
      dispatchRouteChange();
      handleLocationChange();
    });

    // 綁定 storage watcher，並隨 route 切換 key
    bindBookmarkWatcher();

    // 通知 sidebar content script 已就緒
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CHATGPT_READY });
  }

  let hasInitialized = false;

  function startInit() {
    if (hasInitialized) return;
    hasInitialized = true;
    init().catch((err) => console.error("[GPT-mark] init failed:", err));
  }

  // document_idle 可能晚於 load；DOM 已可用時直接初始化
  if (document.readyState === "loading") {
    window.addEventListener("load", startInit, { once: true });
  } else {
    startInit();
  }
})();
