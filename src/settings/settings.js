const LOCALE_MAP = { zh: "zh_TW", en: "en", ja: "ja" };
const LANGUAGE_KEY = "sidebar-language";
const MOOD_KEY = "sidebar-mood";
const NOTION_TOKEN_KEY = "notion-integration-token";
const NOTION_PAGE_KEY = "notion-page-id";

// ----- Token 遮蔽 -----
function maskToken(token) {
  if (!token || token.length <= 10) return token || "";
  const middleLen = token.length - 10;
  return token.slice(0, 10) + "*".repeat(middleLen) + token.slice(-10);
}
function maskId(id) {
  if (!id || id.length <= 8) return id || "";
  return id.slice(0, 4) + "*".repeat(id.length - 8) + id.slice(-4);
}

// 全域儲存翻譯文字
let messages = {};

// ----- i18n -----
// 載入對應語系的語言
async function loadMessages(lang) {
  const loc = LOCALE_MAP[lang] || LOCALE_MAP.zh;
  const url = chrome.runtime.getURL(`_locales/${loc}/messages.json`);
  const res = await fetch(url);
  const json = await res.json();
  messages = Object.fromEntries(
    Object.entries(json).map(([k, v]) => [k, v.message])
  );
}
// 將屬性對應的文字填入元素
function applyMessages() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = messages[key] || el.textContent;
  });
}
// 載入翻譯、套用到頁面、並存到 storage
async function setLanguage(lang) {
  await loadMessages(lang);
  applyMessages();
  chrome.storage.local.set({ [LANGUAGE_KEY]: lang });
}

// ----- mood -----
// 根據 mode 套用主題，並存到 storage
function applyRadioMood(mode) {
  document.body.classList.remove("light", "dark");
  if (mode === "dark" || mode === "light") {
    document.body.classList.add(mode);
  } else {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    document.body.classList.toggle("dark", mq.matches);
    document.body.classList.toggle("light", !mq.matches);
    mq.addEventListener("change", (ev) => {
      document.body.classList.toggle("dark", ev.matches);
      document.body.classList.toggle("light", !ev.matches);
    });
  }
  chrome.storage.local.set({ [MOOD_KEY]: mode });
}

// ----- 初始化設定 -----
async function initSettings() {
  // 載入並套用語系
  const { [LANGUAGE_KEY]: savedLang } = await chrome.storage.local.get(
    LANGUAGE_KEY
  );
  const lang = savedLang || "zh";
  document.getElementById(`lang-${lang}`).checked = true;
  await setLanguage(lang);

  // 載入並套用主題
  const { [MOOD_KEY]: savedMood } = await chrome.storage.local.get(MOOD_KEY);
  const mood = savedMood || "system";
  document.getElementById(`radio-${mood}`).checked = true;
  applyRadioMood(mood);

  // ===== 讀取並填入（遮蔽後）Integration Token =====
  const { [NOTION_TOKEN_KEY]: savedToken } = await chrome.storage.local.get(
    NOTION_TOKEN_KEY
  );
  document.getElementById("notion-token-input").value = maskToken(savedToken);

  // ===== 讀取並填入 Notion Page ID =====
  const { [NOTION_PAGE_KEY]: savedPageId } = await chrome.storage.local.get(
    NOTION_PAGE_KEY
  );
  document.getElementById("notion-page-input").value = maskId(savedPageId);

  // 綁定 radio 變更事件
  document
    .querySelectorAll('.lang-container input[type="radio"]')
    .forEach((input) => {
      input.addEventListener("change", (e) =>
        setLanguage(e.target.id.replace("lang-", ""))
      );
    });
  document
    .querySelectorAll('.mood-container input[type="radio"]')
    .forEach((input) => {
      input.addEventListener("change", (e) =>
        applyRadioMood(e.target.id.replace("radio-", ""))
      );
    });
}
// ----- 綁定儲存按鈕 -----
document.addEventListener("DOMContentLoaded", () => {
  initSettings();

  const tokenEl = document.getElementById("notion-token-input");
  const pageEl = document.getElementById("notion-page-input");

  document
    .getElementById("save-notion-token")
    .addEventListener("click", async () => {
      const raw = tokenEl.value.trim();
      if (!raw) return console.warn("請輸入有效 Token");

      await chrome.storage.local.set({ [NOTION_TOKEN_KEY]: raw });
      tokenEl.value = maskToken(raw);
      console.log("🔑  Token 已更新");
    });

  document
    .getElementById("save-notion-page")
    .addEventListener("click", async () => {
      const id = pageEl.value.trim().replace(/-/g, "");
      if (!/^[0-9a-fA-F]{32}$/.test(id))
        return console.warn("Page ID 需為 32 位 16 進位字元");

      await chrome.storage.local.set({ [NOTION_PAGE_KEY]: id });
      pageEl.value = maskId(id);
      console.log("📄  Page ID 已更新");
    });
});

// 綁定匯出按鈕
document
  .getElementById("download-btn")
  .addEventListener("click", downloadBookmarks);

async function downloadBookmarks() {
  chrome.storage.local.get(null, (res) => {
    const chats = [];

    for (const [pathname, messages] of Object.entries(res)) {
      if (!Array.isArray(messages) || messages.length === 0) continue;

      const parts = pathname.split("/");
      const chatId = parts.at(-1);
      const url = pathname.startsWith("/c/")
        ? `https://chatgpt.com${pathname}`
        : `https://chat.openai.com${pathname}`;

      const formattedMessages = messages.map((msg) => ({
        id: msg.id,
        role:
          msg.role === "assistant"
            ? "ChatGPT"
            : msg.role === "user"
            ? "User"
            : msg.role || "Unknown",
        content: msg.content || "",
        hashtags: msg.hashtags || [],
      }));

      chats.push({
        chatId,
        url,
        bookmarkCount: formattedMessages.length,
        bookmarks: formattedMessages,
      });
    }

    const payload = {
      downloadInfo: {
        downloadedAt: new Date().toISOString(),
        totalChats: chats.length,
      },
      chats,
    };

    const blob = new Blob([JSON.stringify(payload, null, 4)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chatgpt_bookmarks.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initSettings();

  // 綁定 Notion Token 儲存
  document
    .getElementById("save-notion-token")
    .addEventListener("click", async () => {
      const token = document.getElementById("notion-token-input").value.trim();
      if (token) {
        await chrome.storage.local.set({ [NOTION_TOKEN_KEY]: token });
        // 可選：顯示一個短暫提示，或切換 icon
        console.log("Notion Token 已儲存");
      } else {
        console.warn("請輸入有效的 Notion Token");
      }
    });
});

// DOM 載入完成後執行初始化
document.addEventListener("DOMContentLoaded", initSettings);
