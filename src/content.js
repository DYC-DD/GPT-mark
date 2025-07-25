console.log("ChatGPT Bookmark 插件已載入！");

let sendButton = null;

let enterPressCount = 0;
let enterPressTimer = null;
const DOUBLE_CLICK_DELAY = 200; // 雙擊的延遲時間（毫秒）

/*
 * ---------- 編輯下 Enter 雙擊送出功能 ----------
 */

/*
 * 判斷當前事件的目標元素是否為 ChatGPT 的訊息輸入框
 */
function isChatInput(target) {
  if (target.tagName === "TEXTAREA") return true;
  if (target.role === "textbox" && target.dataset.testid === "text-input")
    return true;
  if (target.classList.contains("grow-wrap")) return true;
  if (target.matches("div.flex-grow.relative > div > textarea")) return true;
  return false;
}

/*
 * 判斷當前頁面是否處於編輯訊息模式
 * 透過檢查編輯模式特有的發送按鈕來判斷
 */
function isEditingMode() {
  const editSendButton = document.querySelector(
    "button.btn.relative.btn-primary"
  );
  return !!editSendButton;
}

/*
 * 嘗試找到 ChatGPT 的發送按鈕
 */
function findSendButton() {
  let button = document.querySelector('[data-testid="send-button"]');
  if (button) return button;

  button = document.querySelector("button.btn.relative.btn-primary");
  if (button) return button;

  button = document.querySelector('button[aria-label="Send message"]');
  if (button) return button;

  button = document.querySelector('button[aria-label="Send"]');
  if (button) return button;

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

/*
 * 在指定的輸入框中插入換行符
 */
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

/*
 * 處理鍵盤按下事件的核心邏輯
 */
function handleKeyDown(event) {
  const currentInputTarget = event.target;

  if (isChatInput(currentInputTarget)) {
    const inEditingMode = isEditingMode();

    // 處理 Shift + Enter：總是換行
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

/*
 * ---------- 書籤功能 ----------
 */

// 動態載入的掃描間隔（毫秒）
const SCAN_INTERVAL = 2000;

const EMPTY_ICON = "assets/icons/bookmarks.svg";
const FILL_ICON = "assets/icons/bookmarks-fill.svg";

/**
 * 取得目前聊天室 URL 路徑作為書籤儲存 key
 */
function getCurrentChatKey() {
  return window.location.pathname;
}

/**
 * 從 chrome.storage.local 中讀取目前聊天室的書籤
 */
function fetchBookmarks(cb) {
  const key = getCurrentChatKey();
  chrome.storage.local.get([key], (res) => cb(res[key] || []));
}

/**
 * 將書籤列表存回 local storage
 */
function saveBookmarks(list) {
  const key = getCurrentChatKey();
  chrome.storage.local.set({ [key]: list });
}

/**
 * 判斷訊息是否已是書籤
 */
function isBookmarked(id, list) {
  return list.some((item) => item.id === id);
}

/**
 * 切換書籤狀態：加入或移除，並在完成後執行 callback
 */
function toggleBookmark(id, content, role, cb) {
  fetchBookmarks((list) => {
    const updated = isBookmarked(id, list)
      ? list.filter((item) => item.id !== id)
      : [...list, { id, content, role }];
    saveBookmarks(updated);
    if (cb) cb(updated);
  });
}

/**
 * 取得滑鼠懸浮時要使用的背景色
 */
function getHoverBgColor() {
  return document.documentElement.classList.contains("dark")
    ? "#303030"
    : "#E8E8E8";
}

/**
 * 取得目前主題下對應的 icon 濾鏡
 */
function getIconFilter() {
  return document.documentElement.classList.contains("dark")
    ? "brightness(0) invert(1)"
    : "brightness(0)";
}

// 建立書籤按鈕
function createBookmarkButton(msg) {
  const id = msg.dataset.messageId;
  if (
    !id ||
    document.querySelector(`.chatgpt-bookmark-btn[data-bookmark-id="${id}"]`)
  ) {
    return null;
  }

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

  const icon = document.createElement("img");
  Object.assign(icon.style, {
    width: "16px",
    height: "16px",
    pointerEvents: "none",
    filter: getIconFilter(),
  });
  btn.appendChild(icon);

  fetchBookmarks((list) => {
    const file = isBookmarked(id, list) ? FILL_ICON : EMPTY_ICON;
    icon.src = chrome.runtime.getURL(file);
  });

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

// 為 turn 裡的訊息插入書籤按鈕
function tryInjectButton(msg) {
  const btn = createBookmarkButton(msg);
  if (!btn) return;

  const turn = msg.closest("article");
  const copyBtn = turn?.querySelector(
    '[data-testid="copy-turn-action-button"]'
  );
  if (copyBtn && copyBtn.parentNode) {
    copyBtn.parentNode.insertBefore(btn, copyBtn);
  }
}

// 一次性為已存在的 messages 注入書籤按鈕
function injectExistingBookmarks() {
  document
    .querySelectorAll("[data-message-author-role][data-message-id]")
    .forEach((msg) => tryInjectButton(msg));
}

// 用 MutationObserver 監聽所有新加進來的「turn」
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
  });
}

/**
 * 主題切換後 更新所有書籤 icon 濾鏡
 */
function updateBookmarkIcons() {
  const filter = getIconFilter();
  document.querySelectorAll(".chatgpt-bookmark-btn img").forEach((icon) => {
    icon.style.filter = filter;
  });
}

/**
 * 監聽 <html> class 變化（dark / light 切換）
 */
function observeMoodChange() {
  const observer = new MutationObserver(() => {
    updateBookmarkIcons();
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

// 啟動時等最外層 DOM 構建完成
window.addEventListener("load", () => {
  injectExistingBookmarks();
  observeAllTurns();
  observeMoodChange();

  // 少數情況補漏
  setTimeout(injectExistingBookmarks, SCAN_INTERVAL);
});

// 滾動到特定訊息並高亮提示
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

// 回傳當前聊天室所有 user 訊息的順序（供 sidebar 排序）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getChatOrder") {
    const elems = document.querySelectorAll(
      '[data-message-author-role="user"][data-message-id], [data-message-author-role="assistant"][data-message-id]'
    );
    const order = Array.from(elems).map((el) => el.dataset.messageId);
    sendResponse({ order });
  }
});

// 監聽側邊欄滾動指令
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

chrome.runtime.sendMessage({ type: "chatgpt-ready" });
