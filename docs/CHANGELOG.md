# CHANGELOG

This changelog follows the [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/) format to track version updates.

## [3.1.0] - 2025-07-29

### Added

- 新增「右鍵選單」快速開啟側邊欄功能（僅限 ChatGPT 網頁）
- `manifest.json` 增加 `contextMenus` 權限

### Changed

- 調整擴充功能說明與名稱欄位（多語系 message.json 中）
- 匯出書籤 JSON 檔案結構更新：
  - 外層包含 `downloadInfo`（下載時間與聊天室數）
  - 書籤欄位包含 `chatId`、`url`、`bookmarks`（含 `id`、`content`、`role`、`hashtags`）

### Fixed

- 修正非 ChatGPT 網站仍保留側邊欄狀態的問題

## [3.0.0] - 2025-07-26

### Added

- 新增 `settings.html` 與 `settings.js` 設定頁，集中管理使用者偏好（主題、語言）
  - 支援語言切換：中文、English、日本語（i18n）
  - 支援主題選擇：亮色 / 暗色 / 系統自動（含自動監聽系統變更）
    - 新增 system 主題圖示（`system.svg`）並整合至 UI
  - 新增「下載書籤」按鈕，可匯出所有書籤為 JSON
    - 書籤匯出格式包含：chatId、訊息內容、角色、hashtags 等欄位
- 書籤功能支援標記 ChatGPT 回覆訊息
- 書籤 icon 會根據主題自動切換顏色（light / dark / system）

### Changed

- 將主題與語言設定從 sidebar 拆出，改為獨立 `settings` 頁面處理
- 書籤 UI 整體重新設計，樣式更貼近 ChatGPT 官方風格
  - 包含圓角、間距、icon 調整、hover 效果優化
- 重構 sidebar 的布局與按鈕配置，提升視覺一致性與操作易用性
- 替換書籤圖示為新版設計，並調整在訊息區塊中的定位避免遮擋

### Improved

- 使用 `chrome.storage` 同步設定變更並即時套用至 UI
- 調整初始化邏輯：可正確讀取並記憶上次主題與語言設定
- 新增自動偵測系統主題，首次載入即自動套用偏好
- 所有欄位縮排、換行、命名風格統一，增進可維護性與一致性
- 補充程式區塊註解，強化邏輯可讀性與結構清晰度

### Fixed

- 修正語言切換後未正確寫入 `chrome.storage` 的問題
- 修正書籤路徑錯誤綁定造成無法跳轉訊息的情況
- 解決部份操作流程造成的 UI 錯位與邏輯異常

## [2.2.2] - 2025-07-19

### Added

- 新增「快速滾動」按鈕：
  - 在側邊欄下方加入「滾動至最上方」與「滾動至最下方」功能按鈕
  - 支援平滑動畫滾動至 ChatGPT 對話最上下端

### Changed

- 調整側邊欄 UI/UX：
  - 書籤按鈕 hover 效果更柔和
  - 調整元件間距與主題一致性
  - scroll button、語言選單、排序選單位置與樣式微調

### Fixed

- 修復部分狀況下錯誤訊息未被正確捕捉或處理
  - 加強對 `chrome.runtime.lastError` 的錯誤處理顯示與 fallback 行為

## [2.2.1] - 2025-07-12

### Fixed

- 修正 `manifest.json` 中 `matches` 與 `host_permissions` 欄位設定
  - 確保 content script 僅注入 `https://chatgpt.com/*` 與 `https://chat.openai.com/*` 頁面
- 避免在非 ChatGPT 網域錯誤載入腳本

## [2.2.0] - 2025-07-11

### Added

- 多語系支援 i18n：
  - 支援 `zh-TW`、`en`、`ja` 語言自動切換
  - 使用 Chrome extension `_locales` 機制管理翻譯字串
  - 支援側邊欄 UI、提示文字、排序選單等多語顯示

### Technical

- 新增 `_locales/` 資料夾，包含：
  - `_locales/zh_TW/messages.json`
  - `_locales/en/messages.json`
  - `_locales/ja/messages.json`
- 可根據瀏覽器語系自動切換語言

## [2.1.1] - 2025-07-10

### Added

- 新增多尺寸 logo 圖示：
  - `16x16`、`48x48`、`128x128` 等尺寸支援
  - 符合 Chrome Web Store 上架需求與系統相容性

## [2.1.0] - 2025-07-10

### Added

- 書籤支援 Hashtag 標籤管理 功能
  - 可為每個書籤新增、刪除自訂 hashtag
  - 側邊欄可依 hashtag 過濾書籤
- 每則書籤顯示所屬 hashtag，支援移除與切換選取狀態

## [2.0.1] - 2025-07-09

### Fixed

- 修復非 `https://chatgpt.com/*` 下點擊工具跳出 error message

## [2.0.0] - 2025-07-09

### Added

- 書籤功能：可對使用者訊息加上書籤、儲存並集中管理
- 側邊欄頁面：
  - 支援書籤排序（依聊天順序或加入順序）
  - 點選跳轉訊息
  - 主題切換（light / dark）
  - 書籤最大顯示字數限制
- 書籤 icon 圖示支援主題切換自動反色

### Technical

- 採用 Manifest V3 架構
- 僅在 `https://chatgpt.com/*` 下啟用

## [1.0.0] - 2025-05-29

### Added

- 初始功能版本
- 編輯模式下支援
  - `單次 Enter` / `Shift + Enter` 為換行
  - `雙擊 Enter` 為送出訊息
