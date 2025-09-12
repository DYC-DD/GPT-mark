const LOCALE_MAP = { zh: "zh_TW", en: "en", ja: "ja" };
const LANGUAGE_KEY = "sidebar-language";
const MOOD_KEY = "sidebar-mood";

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
  dualSetSetting(LANGUAGE_KEY, lang);
}

// ----- mood -----
let _mqListener = null;
// 根據 mode 套用主題，並存到 storage
function applyRadioMood(mode) {
  document.body.classList.remove("light", "dark");
  if (_mqListener) {
    _mqListener.mq.removeEventListener("change", _mqListener.fn);
    _mqListener = null;
  }

  if (mode === "dark" || mode === "light") {
    document.body.classList.add(mode);
  } else {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    document.body.classList.add(mq.matches ? "dark" : "light");
    const fn = (ev) => {
      document.body.classList.toggle("dark", ev.matches);
      document.body.classList.toggle("light", !ev.matches);
    };
    mq.addEventListener("change", fn);
    _mqListener = { mq, fn };
  }
  dualSetSetting(MOOD_KEY, mode);
}

// ----- 初始化設定 -----
["sidebar-language", "sidebar-mood"].forEach(async (k) => {
  const [loc, syn] = await Promise.all([
    chrome.storage.local.get([k]),
    chrome.storage.sync.get([k]),
  ]);
  if (syn[k] === undefined && loc[k] !== undefined) {
    await chrome.storage.sync.set({ [k]: loc[k] });
  }
});
async function initSettings() {
  // 載入並套用語系
  const lang = await dualGetSetting(LANGUAGE_KEY, "zh");
  document.getElementById(`lang-${lang}`).checked = true;
  await setLanguage(lang);

  // 載入並套用主題
  const mood = await dualGetSetting(MOOD_KEY, "system");
  document.getElementById(`radio-${mood}`).checked = true;
  applyRadioMood(mood);

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

// 綁定匯出按鈕
document
  .getElementById("download-btn")
  .addEventListener("click", downloadBookmarks);

async function downloadBookmarks() {
  const [locAll, synAll] = await Promise.all([
    chrome.storage.local.get(null),
    chrome.storage.sync.get(null),
  ]);

  const allKeys = new Set([
    ...Object.keys(locAll).filter((k) => k.startsWith("/c/")),
    ...Object.keys(synAll).filter((k) => k.startsWith("/c/")),
  ]);

  const chats = [];
  for (const pathname of allKeys) {
    const merged = await dualRead(pathname);
    const messages = merged.map(withDefaults).filter((m) => !m.deleted);
    if (messages.length === 0) continue;

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
      updatedAt: msg.updatedAt || 0,
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
}

// DOM 載入完成後執行初始化
document.addEventListener("DOMContentLoaded", initSettings);
