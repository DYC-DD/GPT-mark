<div align="center">

[![](../assets/logo/GPT-pin48.png)](https://dyc-dd.github.io/GPT-mark/)

# [ChatGPT Mark](https://dyc-dd.github.io/GPT-mark/)

**「重要訊息總是被淹沒、實用內容也常在滑動中遺失 － 現在你可以隨時標記並一鍵回到原文！」**

![GitHub release](https://img.shields.io/github/v/release/DYC-DD/GPT-mark) ![License](https://img.shields.io/github/license/DYC-DD/GPT-mark) ![last commit](https://img.shields.io/github/last-commit/DYC-DD/GPT-mark) [![website](https://img.shields.io/badge/website-GPT--Mark-0aaaff)](https://dyc-dd.github.io/GPT-mark/) [![Download](https://img.shields.io/badge/Download-Chrome%20Store-4285F4?style=flat&logoColor=white)](https://chromewebstore.google.com/detail/bhkpgjjgjgdgpbjdfhkljhcefohegooc)
[![English](https://img.shields.io/badge/README-English-4285F4?style=flat)](../README.md)

</div>

這是一款為 ChatGPT 網頁介面設計的 Chrome 擴充小工具。為對話加上書籤與快捷傳送功能，支援側邊欄書籤導航、編輯時雙擊 Enter 快速送出訊息，幫助你高效回顧與組織聊天內容！

## 功能說明

**書籤功能**

- 點擊訊息旁的「**書籤按鈕**」即可加入或移除書籤
- 點選側邊欄書籤即可**自動滾動到該訊息**，並高亮顯示
- 提供 **依聊天順序 / 加入順序** 排序選項
- 書籤可新增刪除**自訂的 #hashtag** 以進行分類
- 側邊欄可**依 #hashtag 過濾**顯示書籤

**編輯訊息下快捷傳送**

- 原本 ChatGPT 編輯訊息時，需手動點擊「送出按鈕」才能傳送
- 現在只需 **快速雙擊 Enter** 即可快速傳送
  - `單次 Enter` / `Shift + Enter` 為換行
  - `雙擊 Enter` 為送出訊息

**側邊欄與設定頁**

- 側邊欄支援 **light / dark / system mood** 可手動切換，並記錄偏好
- 側邊欄支援 **繁體中文、英文、日文**介面自動 / 手動切換
- 設定頁可匯出所有書籤資料做為備份

## 安裝方式

- **官方安裝方式（推薦）：**

  - 直接從 Chrome 線上應用程式商店安裝：[📥 點此安裝 GPT-Mark](https://chromewebstore.google.com/detail/bhkpgjjgjgdgpbjdfhkljhcefohegooc?utm_source=item-share-cb)

- **開發人員安裝方式：**

  1. 下載此專案至您想存放位置（`git clone` 方式）：

     ```bash
     git clone git@github.com:DYC-DD/GPT-mark.git
     ```

  2. 打開 Chrome 瀏覽器，輸入：`chrome://extensions`
  3. 開啟右上角的「開發人員模式」
  4. 點擊「載入未封裝項目」
  5. 選取此專案資料夾
  6. 開啟或重新整理 [ChatGPT](https://chatgpt.com/) 即可使用

## Demo 預覽

以下為 ChatGPT Mark 的實際操作示意：

[![Watch on YouTube](https://img.shields.io/badge/YouTube-Demo%20video-red?logo=youtube)](https://youtu.be/kISToM2FhVg)

## 匯出 JSON 結構

匯出的書籤資料結構為 JSON (`chatgpt_bookmarks.json`)，範例格式如下：

```json
{
  "downloadInfo": {
    "downloadedAt": "2025-01-01T06:00:00.000Z",
    "totalChats": 5
  },
  "chats": [
    {
      "chatId": "6884835f-5d24-xxxxxx",
      "url": "https://chatgpt.com/c/xxxxxx",
      "bookmarkCount": 2,
      "bookmarks": [
        {
          "id": "057b6385-751d-xxxxxx",
          "role": "User",
          "content": "一句話介紹 LLM",
          "hashtags": ["AI"],
          "updatedAt": 1755591100546
        },
        {
          "id": "d2c2b291-9ae7-xxxxxx",
          "role": "ChatGPT",
          "content": "大型語言模型（LLM）是透過訓練大量文本資料來理解與生成自然語言。",
          "hashtags": ["AI", "ML", "DL"],
          "updatedAt": 1755591101233
        }
      ]
    }
  ]
}
```

## FAQ

| 語言        | FAQ Link                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| 🇹🇼 繁體中文 | [![FAQ](https://img.shields.io/badge/FAQ-常見問題-blue)](https://dyc-dd.github.io/GPT-mark/?lng=zh-TW#faq)      |
| 🇺🇸 English  | [![FAQ](https://img.shields.io/badge/FAQ-Questions-brightgreen)](https://dyc-dd.github.io/GPT-mark/?lng=en#faq) |
| 🇯🇵 日本語   | [![FAQ](https://img.shields.io/badge/FAQ-よくある質問-orange)](https://dyc-dd.github.io/GPT-mark/?lng=ja#faq)   |

## 注意事項

> [!NOTE]
>
> - 本擴充功能僅作用於 [ChatGPT 官方網站](https://chatgpt.com/)
> - 書籤與設定資料的儲存方式：
>   - 預設儲存於本機：使用 `chrome.storage.local`
>   - 跨裝置同步：同時寫入 `chrome.storage.sync`，在登入同一 Google 帳號的 Chrome 瀏覽器間自動同步。
>     - 需啟用 Chrome 的「同步」功能，並包含擴充功能資料。
>     - 若未啟用同步，資料僅會保存在本機，不影響使用。
> - 資料僅存在於你的 Google 帳號與裝置中，本工具不會將任何資料上傳或分享給作者或第三方伺服器。

## 更新紀錄

查看完整更新紀錄：[CHANGELOG](./docs/CHANGELOG.md)

## License

[MIT License](./LICENSE)
