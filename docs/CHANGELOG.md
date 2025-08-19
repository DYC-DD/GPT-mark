# CHANGELOG

This changelog follows the [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/) format to track version updates.

## [1.1.0] -

### Added

- 新增 Header 元件，包含 logo、導航連結與浮動按鈕。
- 加入頁面錨點功能，支援滑動至 Home、Features、Contact 等段落。
- 嵌入 YouTube 影片於 Features 區塊中，支援響應式顯示與置中樣式。
- 建立 Footer 元件，包含版權與聯絡資訊，顯示於頁面底部。
- 新增 i18n 多語系自動偵測功能，可依據瀏覽器語言自動切換。

## [1.0.1] - 2025-08-01

### Changed

- 修改 Chrome 擴充功能的連結網址，統一導向正式發佈頁面。

## [1.0.0] - 2025-07-16

### Added

- 使用 `vite` + `React` 作為開發與建置工具。
- 首頁組件 `Home`，整合 `Particles` 背景、`ProfileCard` 個人卡片及 GitHub 星數資訊顯示。
- `ProfileCard` 組件，具備 3D 傾斜動畫、動態光暈、個人資訊與社群連結、下載按鈕。
- `Particles` 粒子背景特效，使用 OGL 實現 3D 隨機動態粒子。
- `GithubStars` 元件，動態擷取 GitHub 專案星星數與頭像。
- RWD 響應式設計，支援桌面與行動裝置。
- 支援懸浮互動與視差效果（滑鼠移動時卡片旋轉與光源變化）。
- 呼叫 GitHub API 取得最新 release 的 zipball_url
