# ChatGPT Bookmark Chrome-Extension

**「重點訊息總是被大量回覆淹沒，有用的內容又常在滑動中遺失，怎麼快速標記並精準跳回？」**

這是一款為 [ChatGPT](https://chatgpt.com/) 網頁介面設計的 Chrome 小工具。為對話加上書籤與快捷傳送功能，支援側邊欄書籤導航、編輯時雙擊 Enter 快速送出訊息，幫助你高效回顧與組織聊天內容！

## 使用說明

**書籤功能**

- 點擊使用者訊息下方「**書籤按鈕**」即可加入書籤
- 點選側邊欄書籤即可**自動滾動到該訊息**，並高亮顯示
- 提供 **依聊天順序 / 加入順序** 排序選項
- 書籤儲存在 `chrome.storage.local`，依聊天室分開儲存
- 側邊欄支援 **亮色 / 暗色模式** 可手動切換，並記錄偏好
- 書籤可新增刪除**自訂的 hashtag** 以進行分類
- 側邊欄可**依 hashtag 過濾**顯示書籤
- 支援 **`zh-TW`、`en`、`ja` 語言**介面自動 / 手動切換

**編輯訊息下快捷傳送**

- 原本 ChatGPT 編輯訊息時，需手動點擊「送出按鈕」才能傳送
- 現在只需 **快速雙擊 Enter** 即可快速傳送
  - `單次 Enter` / `Shift + Enter` 為換行
  - `雙擊 Enter` 為送出訊息

## 安裝方式

1. clone 此專案至您想存放位置

   ```bash
   git clone git@github.com:DYC-DD/chatgpt-chrome-extension.git
   ```

2. 打開 Chrome 瀏覽器，輸入
   ```bash
   chrome://extensions
   ```
3. 開啟右上角的「開發人員模式」
4. 點擊「載入未封裝項目」
5. 選取此專案資料夾
6. 開啟或重新整理 [ChatGPT](https://chatgpt.com/) 即可使用

## 注意事項

> - 本擴充功能僅作用於 [ChatGPT 官方網站](https://chatgpt.com/)
