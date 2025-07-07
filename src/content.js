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
 * content.js – 書籤功能（只在 user 訊息上插入按鈕）
 * 這段程式碼會在只有 user(author-role="user") 的訊息旁
 * 注入「加入/移除書籤」按鈕，並使用 chrome.storage.local
 * 儲存不同聊天室的書籤列表。
 */

// 掃描間隔時間（毫秒），用於處理 SPA 動態載入的訊息
const SCAN_INTERVAL = 2000;

/**
 * 取得目前聊天室的唯一 key
 * 直接使用 window.location.pathname (例如 "/chat/ABC123")
 * @returns {string} 聊天室 key
 */
function getCurrentChatKey() {
  return window.location.pathname;
}

/**
 * 從 chrome.storage.local 讀取指定聊天室的書籤列表
 * @param {function(Array<{id:string,content:string}>)} callback 讀取完成後的回呼
 */
function fetchBookmarks(callback) {
  const key = getCurrentChatKey();
  chrome.storage.local.get([key], (result) => {
    const list = result[key] || [];
    callback(list);
  });
}

/**
 * 將書籤列表儲存到 chrome.storage.local
 * @param {Array<{id:string,content:string}>} list 要儲存的書籤列表
 */
function saveBookmarks(list) {
  const key = getCurrentChatKey();
  chrome.storage.local.set({ [key]: list });
}

/**
 * 檢查給定的訊息 ID 是否已被書籤
 * @param {string} id 訊息 ID
 * @param {Array<{id:string,content:string}>} list 書籤列表
 * @returns {boolean} 是否已書籤
 */
function isMessageBookmarked(id, list) {
  return list.some((item) => item.id === id);
}

/**
 * 切換書籤狀態：若已存在則移除，否則新增。
 * 完成後可透過 callback 拿到更新後列表。
 * @param {string} id 訊息 ID
 * @param {string} content 訊息內容
 * @param {function(Array)} [callback] 更新完成後的回呼
 */
function toggleBookmark(id, content, callback) {
  fetchBookmarks((list) => {
    let updated;
    if (isMessageBookmarked(id, list)) {
      // 移除已存在的書籤
      updated = list.filter((item) => item.id !== id);
    } else {
      // 新增書籤
      updated = [...list, { id, content }];
    }
    // 儲存更新後列表
    saveBookmarks(updated);
    if (callback) callback(updated);
  });
}

/**
 * 掃描所有 user 發言(ChatGPT user)的訊息節點，
 * 並在尚未注入按鈕的訊息旁注入「加入/移除書籤」按鈕
 */
function setupBookmarkButtons() {
  // 1. 只選取 data-message-author-role="user" AND data-message-id 的訊息
  const messages = document.querySelectorAll(
    '[data-message-author-role="user"][data-message-id]'
  );

  messages.forEach((msg) => {
    const id = msg.dataset.messageId;

    // 如果已經插入按鈕，就跳過
    if (msg.querySelector(".chatgpt-bookmark-btn")) return;

    // 建立按鈕元素
    const btn = document.createElement("button");
    btn.className = "chatgpt-bookmark-btn";
    // 預設樣式，可依需求調整
    Object.assign(btn.style, {
      padding: "4px 10px",
      fontSize: "14px",
      marginLeft: "8px",
      borderRadius: "6px",
      border: "1px solid #999",
      cursor: "pointer",
      transition: "all 0.2s ease-in-out",
    });

    // 讀取書籤列表，再設定按鈕初始狀態（文字與樣式）
    fetchBookmarks((list) => {
      const booked = isMessageBookmarked(id, list);
      btn.textContent = booked ? "移除書籤" : "加入書籤";
      btn.style.backgroundColor = booked ? "#ffe082" : "#222";
      btn.style.color = booked ? "#000" : "#fff";
    });

    // 點擊事件：切換書籤並更新按鈕狀態
    btn.addEventListener("click", () => {
      const content = msg.innerText.trim();
      toggleBookmark(id, content, (updatedList) => {
        const booked = isMessageBookmarked(id, updatedList);
        btn.textContent = booked ? "移除書籤" : "加入書籤";
        btn.style.backgroundColor = booked ? "#ffe082" : "#222";
        btn.style.color = booked ? "#000" : "#fff";
      });
    });

    // 將按鈕插入到 user 訊息的右上角(或尾端做後備)
    const header = msg.querySelector("div > div.flex.justify-between");
    if (header) {
      header.appendChild(btn);
    } else {
      msg.appendChild(btn);
    }
  });
}

// 啟動定時掃描，每隔 SCAN_INTERVAL 處理動態載入的 user 訊息
setInterval(setupBookmarkButtons, SCAN_INTERVAL);
