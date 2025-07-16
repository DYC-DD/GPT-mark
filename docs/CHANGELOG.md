# CHANGELOG

This changelog follows the [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/) format to track version updates.

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
