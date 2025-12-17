# CHANGELOG

This changelog follows the [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/) format to track version updates.

## [3.2.6] - 2025-12-17

### Fixed

- 修正 ChatGPT 前端更新後，因可滾動容器（scroll container）選取失準，導致以下功能失效的問題：
  - 點擊書籤無法捲動到對應訊息
  - `Scroll to top` / `Scroll to bottom` 按鈕無法捲動到頂部或底部
- 改用更穩定的方式取得聊天室主要捲動容器：
  - 優先從 `thread-bottom-container` / `thread-bottom` 反推最近的可捲動祖先節點
  - 若不存在則從任一訊息節點（`[data-message-id]`）反推
  - 最後才 fallback：在 `main` 中挑選高度最大的可捲動元素
- 統一滾動行為的容器來源，避免因 ChatGPT DOM 結構／class 變動造成再次誤捲到錯誤元素

### Refactored

- 重構 `content.js`：
  - 將「捲動容器偵測」抽成獨立 helper（`getChatScrollContainer()`），並移除硬編碼的 class selector
  - 調整程式碼分區與命名，降低重複邏輯與提升可讀性（不影響既有功能）

## [3.2.5] - 2025-09-12

### Changed

- 將語言 (`LANGUAGE_KEY`) 與主題 (`MOOD_KEY`) 設定儲存位置從 `local` 改為 `sync`，支援多裝置同步偏好
  - 在 popup.html 中修改切換語言 / 主題設定邏輯，確保會同步儲存至 `chrome.storage.sync`
  - 可在不同電腦間同步語系與主題偏好，不需每次手動重設

## [3.2.4] - 2025-09-09

### Changed

- 將原本於 `chrome://extensions` 中開啟的設定頁（`settings.html`）改為 **popup 彈出式介面** 呈現

  - 使用者點擊擴充功能 icon 即可開啟設定，無需另開分頁
  - 使用 `chrome.action.default_popup` 與 `chrome.action.openPopup()` 實現
  - 側邊欄中的設定按鈕會動態指派 popup，並於點擊後清除綁定避免干擾其他分頁

- 優化 popup 彈窗樣式與互動行為
- 統一所有語言環境下的插件名稱為 **ChatGPT Mark**
  - 更新 `_locales/zh_TW/messages.json`、`en/messages.json`、`ja/messages.json` 中的 `name` 欄位
  - 將原本名稱如「ChatGPT 書籤」改為一致的英文命名，便於辨識與國際化
- 修改整體字體樣式為「Google Sans Code」

## [3.2.3] - 2025-09-06

### Fixed

- 修正 `lang-control-group` 區塊滾動時定位錯誤，現在會正確固定在側邊欄底部
- 修正同步資料時，`dualRead` 對 `sync` 未回灌導致書籤 ID 不一致的問題
  - 確保跨裝置同步後資料可正確合併與一致

## [3.2.2] - 2025-09-03

### Fixed

- 修正 `lang-control-group` 區塊在側邊欄因內容過多時的 **定位錯誤與滾動重疊問題**
  - 現在會正確固定在底部，不會因滾動而被遮擋或錯位
  - 同時避免遮住部分書籤內容

## [3.2.1] - 2025-08-21

### Fixed

- 修正 `dualRead` 未回灌 sync 導致的跨裝置同步不一致問題
- 修正 `handleLocationChange` 重複定義造成的事件處理不確定性
- 修正滾動功能在特定情況下無法準確滾至最上 / 最下的問題
- 修正訊息高亮樣式背景顏色過淡或突兀的顯示問題

### Changed

- 移除覆蓋的舊版 `dualRead`，統一保留「必要時才回灌 sync」的實作方式
- 確保 `dualRead` 在合併差異後自動排程同步寫入 sync 儲存空間
- 移除 `content.js` 中未使用的工具函式（如 `toShadow`, `mergeItems`, `mergeLists` 等）
- 所有資料存取邏輯統一透過 `shared/dual-storage.js` 管理，避免重複維護與覆寫風險
- 高亮提示樣式調整並加上漸變動畫，提升辨識度與體驗一致性
- 更新初始化邏輯，將預設模式改為 system，而非固定的亮/暗模式

## [3.2.0] - 2025-08-15

### Added

- 書籤資料改為**同時儲存至 `chrome.storage.local` 與 `chrome.storage.sync`**，支援跨裝置同步。
- 新增 **資料分片 (sharding)** 機制，避免 `chrome.storage.sync` 單鍵 8KB 限制。
- 實作 **影子版本 (shadow payload)**，大內容會截短後存於 sync，完整內容保留在 local。
- 新增 **資料合併與衝突處理**：
  - 以 `updatedAt` 較新者為準。
  - `hashtags` 取聯集，避免遺失分類資訊。
  - 保留較長的內容，避免影子覆蓋完整內容。
  - 刪除狀態 (墓碑) 以較新者為準，避免誤復活。
- 為書籤項目新增 `createdAt` 欄位，用於「依加入順序」排序。
- 復活書籤時自動清空舊的 `hashtags` 並重置 `createdAt`。
- 新增 **debounce + 指數退避** 寫入機制，避免快速操作觸發 `MAX_WRITE_OPERATIONS_PER_MINUTE` 限制。
- 側邊欄排序功能支援：
  - 依加入順序（使用 `createdAt`）
  - 依聊天順序（依 DOM 順序）

### Changed

- 調整 `content.js` 與 `sidebar.js`：
  - 共用 `dual-storage.js` 工具處理 local + sync 雙存儲邏輯。
  - 監聽當前聊天室 key 的 local + sync 變動，即時刷新 UI。
  - SPA（單頁應用）聊天室切換時，自動重綁監聽器並更新書籤狀態。
- 更新 `settings.js` 匯出功能，輸出前先合併 local + sync 資料，確保結果為最新同步版本。

### Fixed

- 修正新增/刪除書籤速度過快時的同步錯誤與 quota 超限問題。
- 修正「依加入順序」排序未正確依新增時間排列的問題。
- 修正取消書籤後再次加入仍保留舊 `hashtags` 的問題。
- 修正書籤按鈕插入時的競態條件問題，避免初始化階段重複渲染或錯誤顯示
- 修復從其他聊天室切換回主頁時，側邊欄未正確清除書籤內容的問題（避免顯示殘留資料）

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
