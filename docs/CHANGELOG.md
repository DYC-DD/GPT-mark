# CHANGELOG

This changelog follows the [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/) format to track version updates.

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
