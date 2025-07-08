console.log("ChatGPT Enter插件已載入！");

let sendButton = null;

let enterPressCount = 0; // 追蹤 Enter 鍵按下的次數
let enterPressTimer = null; // 用於判斷雙擊的計時器
const DOUBLE_CLICK_DELAY = 200; // 雙擊的延遲時間（毫秒）

/*
 * 判斷當前事件的目標元素是否為 ChatGPT 的訊息輸入框
 */
function isChatInput(target) {
  // 檢查多種可能的輸入框元素類型和屬性
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
 * 包含多種選擇器，以適應不同模式和介面變化
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

/**
 * content.js – 書籤功能（只在 user 訊息上插入 icon 按鈕）
 * 並依據主題 dark/light 套用底色
 */

// 掃描間隔（毫秒），處理 SPA 新增訊息
const SCAN_INTERVAL = 2000;

// icon 路徑
const EMPTY_ICON = "assets/icons/bookmark-star.svg";
const FILL_ICON = "assets/icons/bookmark-star-fill.svg";

/** 取得當前聊天室 key */
function getCurrentChatKey() {
  return window.location.pathname;
}

/** 讀書籤 */
function fetchBookmarks(cb) {
  const key = getCurrentChatKey();
  chrome.storage.local.get([key], (res) => cb(res[key] || []));
}

/** 存書籤 */
function saveBookmarks(list) {
  const key = getCurrentChatKey();
  chrome.storage.local.set({ [key]: list });
}

/** 訊息是否已書籤 */
function isBookmarked(id, list) {
  return list.some((item) => item.id === id);
}

/** 切換書籤 */
function toggleBookmark(id, content, cb) {
  fetchBookmarks((list) => {
    const updated = isBookmarked(id, list)
      ? list.filter((item) => item.id !== id)
      : [...list, { id, content }];
    saveBookmarks(updated);
    if (cb) cb(updated);
  });
}

/** 依照 theme 回傳底色 */
function getThemeColor() {
  return document.documentElement.classList.contains("dark")
    ? "#F3F3F3"
    : "#5D5D5D";
}

/** 設定按鈕 icon & 底色 */
function setButtonStyle(btn, iconPath) {
  const url = chrome.runtime.getURL(iconPath);
  // 設定 mask-image（Chrome 需同時設定 -webkit- 與 未加前綴）
  btn.style.webkitMaskImage = `url(${url})`;
  btn.style.maskImage = `url(${url})`;
  btn.style.webkitMaskSize = "contain";
  btn.style.maskSize = "contain";
  btn.style.webkitMaskRepeat = "no-repeat";
  btn.style.maskRepeat = "no-repeat";
  btn.style.webkitMaskPosition = "center";
  btn.style.maskPosition = "center";
  // 底色
  btn.style.backgroundColor = getThemeColor();
}

/** 注入書籤按鈕 */
function setupBookmarkButtons() {
  const msgs = document.querySelectorAll(
    '[data-message-author-role="user"][data-message-id]'
  );
  msgs.forEach((msg) => {
    const id = msg.dataset.messageId;
    if (msg.querySelector(".chatgpt-bookmark-btn")) return;

    // 建立按鈕
    const btn = document.createElement("button");
    btn.className = "chatgpt-bookmark-btn";
    Object.assign(btn.style, {
      width: "20px",
      height: "20px",
      border: "none",
      padding: "0",
      marginLeft: "8px",
      cursor: "pointer",
    });

    // 依書籤狀態設定 icon
    fetchBookmarks((list) => {
      const icon = isBookmarked(id, list) ? FILL_ICON : EMPTY_ICON;
      setButtonStyle(btn, icon);
    });

    // 點擊切換書籤 & icon
    btn.addEventListener("click", () => {
      const content = msg.innerText.trim();
      toggleBookmark(id, content, (updated) => {
        const icon = isBookmarked(id, updated) ? FILL_ICON : EMPTY_ICON;
        setButtonStyle(btn, icon);
      });
    });

    // 插入按鈕到訊息右上角
    const header = msg.querySelector("div > div.flex.justify-between");
    if (header) header.appendChild(btn);
    else msg.appendChild(btn);
  });
}

// 每隔 SCAN_INTERVAL 處理動態新增的訊息
setInterval(setupBookmarkButtons, SCAN_INTERVAL);
