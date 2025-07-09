# CHANGELOG

This changelog follows the [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/) format to track version updates.

## [2.1.0] - 2025-07-10

### Added

- 書籤支援 Hashtag 標籤管理 功能
  - 可為每個書籤新增、刪除自訂 hashtag
  - 側邊欄可依 hashtag 過濾書籤
- 每則書籤顯示所屬 hashtag，支援移除與切換選取狀態

## [2.0.1] - 2025-07-09

- 修復非 `https://chatgpt.com/*` 下點擊工具跳出 error message

### Fixed

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
