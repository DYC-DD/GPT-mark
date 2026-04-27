const { LOCALES, STORAGE_KEYS } = self.GPT_MARK;
const LANGUAGE_KEY = STORAGE_KEYS.SIDEBAR_LANGUAGE;
const MOOD_KEY = STORAGE_KEYS.SIDEBAR_MOOD;

// ===== i18n 狀態 =====
let messages = {};

// ===== i18n 設定 =====
// 載入指定 locale 的 message catalog
async function loadMessages(lang) {
  const loc = LOCALES[lang] || LOCALES.en;
  const url = chrome.runtime.getURL(`_locales/${loc}/messages.json`);
  const res = await fetch(url);
  const json = await res.json();
  messages = Object.fromEntries(
    Object.entries(json).map(([k, v]) => [k, v.message])
  );
}
// 將 data-i18n 對應文字套用至 UI
function applyMessages() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = messages[key] || el.textContent;
  });
}
// 切換語系並同步寫入 storage
async function setLanguage(lang) {
  await loadMessages(lang);
  applyMessages();
  dualSetSetting(LANGUAGE_KEY, lang);
}

// ===== Theme 設定 =====
let _mqListener = null;
// 套用 theme mode，system 模式會監聽 prefers-color-scheme
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

// ===== 初始化設定 =====
[LANGUAGE_KEY, MOOD_KEY].forEach(async (k) => {
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
  const lang = await dualGetSetting(LANGUAGE_KEY, "en");
  document.getElementById(`lang-${lang}`).checked = true;
  await setLanguage(lang);

  // 載入並套用 theme
  const mood = await dualGetSetting(MOOD_KEY, "system");
  document.getElementById(`radio-${mood}`).checked = true;
  applyRadioMood(mood);

  // 綁定 radio change event
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

// ===== Bookmark 匯出 =====
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

// DOM ready 後初始化 popup
document.addEventListener("DOMContentLoaded", initSettings);
