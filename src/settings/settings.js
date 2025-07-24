// 跟 sidebar.js 同一份 locale 資料映射
const LOCALE_MAP = { zh: "zh_TW", en: "en", ja: "ja" };
const LANGUAGE_KEY = "sidebar-language";
const MOOD_KEY = "sidebar-mood";
const MOON_ICON = "assets/icons/moon.svg";
const SUN_ICON = "assets/icons/sun.svg";

let messages = {};
const languageSelect = document.getElementById("language-select");

// 初始化：從 chrome.storage 讀現有語言並套用 UI
chrome.storage.local.get(LANGUAGE_KEY, (res) => {
  const lang = res[LANGUAGE_KEY] || "zh";
  languageSelect.value = lang;
  loadMessages(lang).then(applyMessages);
});

// 當使用者選擇新語言時
languageSelect.addEventListener("change", (e) => {
  const newLang = e.target.value; // 'zh' / 'en' / 'ja'
  // 寫入 chrome.storage.local
  chrome.storage.local.set({ [LANGUAGE_KEY]: newLang }, () => {
    // 立即在設定頁面套用
    loadMessages(newLang).then(applyMessages);
    // 不需要重新載入頁面
  });
});

// 讀取翻譯文字
async function loadMessages(lang) {
  const loc = LOCALE_MAP[lang] || LOCALE_MAP.zh;
  const url = chrome.runtime.getURL(`_locales/${loc}/messages.json`);
  const res = await fetch(url);
  const json = await res.json();
  messages = Object.fromEntries(
    Object.entries(json).map(([k, v]) => [k, v.message])
  );
}

// 套用 i18n
function applyMessages() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = messages[key] || el.textContent;
  });
}

// 初始化 UI
async function initSettings() {
  // 語系
  const langSel = document.getElementById("language-select");
  const savedLang = localStorage.getItem(LANGUAGE_KEY) || "zh";
  langSel.value = savedLang;
  await loadMessages(savedLang);
  applyMessages();

  langSel.addEventListener("change", async () => {
    const lang = langSel.value;
    localStorage.setItem(LANGUAGE_KEY, lang);
    await loadMessages(lang);
    applyMessages();
  });

  // 主題
  const moodBtn = document.getElementById("mood-toggle");
  const moodIcon = document.getElementById("mood-icon");
  function applyMood(m) {
    const icon = m === "light" ? MOON_ICON : SUN_ICON;
    document.body.dataset.theme = m;
    moodIcon.src = chrome.runtime.getURL(icon);
  }
  // 讀取並套用儲存的主題
  chrome.storage.local.get(MOOD_KEY, (res) => {
    const m = res[MOOD_KEY] || "dark";
    applyMood(m);
  });
  // 點擊切換：寫入 chrome.storage.local
  moodBtn.addEventListener("click", () => {
    chrome.storage.local.get(MOOD_KEY, (res) => {
      const cur = res[MOOD_KEY] || "dark";
      const next = cur === "light" ? "dark" : "light";
      chrome.storage.local.set({ [MOOD_KEY]: next });
      applyMood(next);
    });
  });
}

document.addEventListener("DOMContentLoaded", initSettings);
