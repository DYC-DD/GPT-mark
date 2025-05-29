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
