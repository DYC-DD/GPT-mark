# CHANGELOG

This changelog follows the [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/) format to track version updates.

## [1.0.3] - 2026-05-26

### Fixed

- 修正新版 ChatGPT 編輯訊息按鈕顯示為 `傳送` 時，編輯模式無法雙擊 `Enter` 送出的問題。

## [1.0.2] - 2026-05-24

### Fixed

- 收窄編輯模式判斷範圍，避免一般輸入框被頁面上其他 `Cancel` / `Send` 類按鈕誤判為編輯模式。
- 新增 `window.__doubleEnterSendDebug()`，方便在 ChatGPT 頁面 console 檢查目前焦點輸入框的判斷結果。

## [1.0.1] - 2026-05-19

### Fixed

- 修正一般輸入模式下 `Shift + Enter` 無法換行的問題，現在僅在編輯模式中攔截並處理換行快捷鍵。

## [1.0.0] - 2026-05-18

### Added

- 初始精簡版本，僅保留 ChatGPT 編輯模式中的雙擊 Enter 送出功能。
- 新增以 Enter 鍵圖示製作的擴充功能 logo，包含 16、48、128 像素尺寸。

### Changed

- 編輯訊息時，單次按下 `Enter` 會插入換行。
- 編輯訊息時，`Shift + Enter` 會插入換行。
- 快速連按兩次 `Enter` 會送出已編輯的訊息。

### Removed

- 移除書籤、側邊欄、設定、匯出、主題、語言、儲存同步與右鍵選單等功能。
