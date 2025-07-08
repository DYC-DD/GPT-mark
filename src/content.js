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
 * 按鈕尺寸 32×32px，icon 20×20px，
 * 預設透明，滑鼠懸浮才顯示主題背景色
 */

// 處理 SPA 動態載入的掃描間隔（毫秒）
const SCAN_INTERVAL = 2000;

// icon 檔案路徑
const EMPTY_ICON = "assets/icons/bookmark-star.svg";
const FILL_ICON = "assets/icons/bookmark-star-fill.svg";

/**
 * 取得目前聊天室 key（pathname）
 * @returns {string}
 */
function getCurrentChatKey() {
  return window.location.pathname;
}

/**
 * 從 chrome.storage.local 讀取當前聊天室的書籤列表
 * @param {function(Array)} cb 讀取完成後回呼
 */
function fetchBookmarks(cb) {
  const key = getCurrentChatKey();
  chrome.storage.local.get([key], (res) => cb(res[key] || []));
}

/**
 * 將書籤列表存回 chrome.storage.local
 * @param {Array} list 要存的書籤陣列
 */
function saveBookmarks(list) {
  const key = getCurrentChatKey();
  chrome.storage.local.set({ [key]: list });
}

/**
 * 判斷訊息是否已被書籤
 * @param {string} id 訊息 ID
 * @param {Array} list 書籤列表
 * @returns {boolean}
 */
function isBookmarked(id, list) {
  return list.some((item) => item.id === id);
}

/**
 * 切換書籤：若已存在移除，否則新增，最後執行 cb
 * @param {string} id      訊息 ID
 * @param {string} content 訊息內容
 * @param {function(Array)} cb 更新後回呼
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
 * 取得滑鼠懸浮時要使用的背景色：
 *   dark 模式 → #303030
 *   light 模式 → #E8E8E8
 * @returns {string}
 */
function getHoverBgColor() {
  return document.documentElement.classList.contains("dark")
    ? "#303030"
    : "#E8E8E8";
}

/**
 * 取得 icon 濾鏡設定，使 dark 模式下為白色、light 模式保留黑色
 * @returns {string}
 */
function getIconFilter() {
  return document.documentElement.classList.contains("dark")
    ? "brightness(0) invert(1)"
    : "none";
}

/**
 * 掃描所有 user 發言的訊息，注入可點擊書籤按鈕
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
      width: "32px", // 寬度 32px
      height: "32px", // 高度 32px
      backgroundColor: "transparent", // 預設透明
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

    // 建立 icon 元素
    const icon = document.createElement("img");
    Object.assign(icon.style, {
      width: "20px", // icon 寬 20px
      height: "20px", // icon 高 20px
      pointerEvents: "none",
      filter: getIconFilter(),
    });
    btn.appendChild(icon);

    // 初始載入：設定 icon src 與 filter
    fetchBookmarks((list) => {
      const file = isBookmarked(id, list) ? FILL_ICON : EMPTY_ICON;
      icon.src = chrome.runtime.getURL(file);
      icon.style.filter = getIconFilter();
    });

    // 點擊時切換書籤 & 更新 icon filter
    btn.addEventListener("click", () => {
      const content = msg.innerText.trim();
      toggleBookmark(id, content, (updated) => {
        const file = isBookmarked(id, updated) ? FILL_ICON : EMPTY_ICON;
        icon.src = chrome.runtime.getURL(file);
        icon.style.filter = getIconFilter();
      });
    });

    // 滑鼠移入：套用主題對應背景色
    btn.addEventListener("mouseenter", () => {
      btn.style.backgroundColor = getHoverBgColor();
    });
    // 滑鼠移出：恢復透明
    btn.addEventListener("mouseleave", () => {
      btn.style.backgroundColor = "transparent";
    });

    // 插入按鈕到訊息右上角
    const header = msg.querySelector("div > div.flex.justify-between");
    if (header) header.appendChild(btn);
    else msg.appendChild(btn);
  });
}

// 以 SCAN_INTERVAL 定期掃描動態新增的訊息
setInterval(setupBookmarkButtons, SCAN_INTERVAL);
