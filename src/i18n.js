import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en/qa.json";
import ja from "./locales/ja/qa.json";
import zhTW from "./locales/zh-TW/qa.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: { qaList: en } },
      "zh-TW": { translation: { qaList: zhTW } },
      ja: { translation: { qaList: ja } },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "zh-TW", "ja"],
    detection: {
      order: ["querystring", "localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
    returnObjects: true,
  });

export default i18n;

// 測試 - 清空 localStorage 請在 DevTools Console 輸入以下：
// localStorage.removeItem("i18nextLng");
// location.reload();

// http://localhost:5173/?lng=zh-TW
// http://localhost:5173/?lng=en
// http://localhost:5173/?lng=ja
