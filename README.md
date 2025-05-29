# ChatGPT Chrome-Extension

這是一款為 [ChatGPT](https://chatgpt.com/) 網頁介面設計的 Chrome 小工具。此擴充功能可讓您**在編輯框內雙擊 Enter 鍵立即傳送訊息，而按一下 Enter 鍵則可換行**，讓您更直覺地控制訊息格式化與送出行為，告別誤發送的困擾！

## 安裝方式

1. clone 此專案至您想存放位置

   ```bash
   git clone git@github.com:DYC-DD/chatgpt-chrome-extension.git
   ```

2. 打開 Chrome 瀏覽器，輸入 `chrome://extensions`
3. 開啟右上角的「開發人員模式」
4. 點擊「載入未封裝項目」
5. 選取此專案資料夾
6. 開啟或重新整理 [ChatGPT](https://chatgpt.com/) 即可使用

## 使用說明

**在編輯回覆下：**

- `Enter` 單次按下為換行
- `Shift + Enter` 強制換行
- `Enter` 快速連按兩次立即送出訊息

## 注意事項

> - 本擴充功能僅作用於 [ChatGPT 官方網站](https://chatgpt.com/)
> - 若日後網站介面變動，需更新 [content.js](content.js)中的 `querySelector` 選擇器以維持功能正常
