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

// DOM 載入完成後執行初始化
document.addEventListener("DOMContentLoaded", initSettings);
