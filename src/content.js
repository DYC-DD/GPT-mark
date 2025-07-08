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

const EMPTY_ICON = "assets/icons/bookmark-star.svg";
const FILL_ICON = "assets/icons/bookmark-star-fill.svg";

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
function toggleBookmark(id, content, cb) {
  fetchBookmarks((list) => {
    const updated = isBookmarked(id, list)
      ? list.filter((item) => item.id !== id)
      : [...list, { id, content }];
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
    : "none";
}

/**
 * 掃描所有使用者訊息 若尚未有書籤按鈕則注入
 */
function setupBookmarkButtons() {
  const msgs = document.querySelectorAll(
    '[data-message-author-role="user"][data-message-id]'
  );

  msgs.forEach((msg) => {
    const id = msg.dataset.messageId;

    // 已有按鈕就略過
    if (msg.querySelector(".chatgpt-bookmark-btn")) return;

    // 建立按鈕
    const btn = document.createElement("button");
    btn.className = "chatgpt-bookmark-btn";
    btn.title = "書籤";
    Object.assign(btn.style, {
      width: "32px",
      height: "32px",
      backgroundColor: "transparent",
      border: "none",
      borderRadius: "8px",
      padding: "0",
      marginLeft: "8px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      transition: "background-color 0.2s",
    });

    // 建立 icon 圖示
    const icon = document.createElement("img");
    Object.assign(icon.style, {
      width: "20px",
      height: "20px",
      pointerEvents: "none",
      filter: getIconFilter(),
    });
    btn.appendChild(icon);

    // 載入書籤狀態
    fetchBookmarks((list) => {
      const file = isBookmarked(id, list) ? FILL_ICON : EMPTY_ICON;
      icon.src = chrome.runtime.getURL(file);
      icon.style.filter = getIconFilter();
    });

    // 點擊時切換書籤狀態與 icon 圖示
    btn.addEventListener("click", () => {
      const content = msg.innerText.trim();
      toggleBookmark(id, content, (updated) => {
        const file = isBookmarked(id, updated) ? FILL_ICON : EMPTY_ICON;
        icon.src = chrome.runtime.getURL(file);
        icon.style.filter = getIconFilter();
      });
    });

    // hover 效果
    btn.addEventListener("mouseenter", () => {
      btn.style.backgroundColor = getHoverBgColor();
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.backgroundColor = "transparent";
    });

    const header = msg.querySelector("div > div.flex.justify-between");
    if (header) header.appendChild(btn);
    else msg.appendChild(btn);
  });
}

// 定期掃描新訊息以注入書籤按鈕
setInterval(setupBookmarkButtons, SCAN_INTERVAL);

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
      '[data-message-author-role="user"][data-message-id]'
    );
    const order = Array.from(elems).map((el) => el.dataset.messageId);
    sendResponse({ order });
  }
});
