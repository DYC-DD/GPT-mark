<div align="center">

[![](./assets/logo/GPT-pin48.png)](https://dyc-dd.github.io/GPT-mark/)

# [ChatGPT Mark](https://dyc-dd.github.io/GPT-mark/)

**“Important messages get buried, useful content gets lost while scrolling.”**  
**“now you can mark and return to them instantly.”**

![GitHub release](https://img.shields.io/github/v/release/DYC-DD/GPT-mark) ![License](https://img.shields.io/github/license/DYC-DD/GPT-mark) ![last commit](https://img.shields.io/github/last-commit/DYC-DD/GPT-mark) [![website](https://img.shields.io/badge/website-GPT--Mark-0aaaff)](https://dyc-dd.github.io/GPT-mark/) [![Download](https://img.shields.io/badge/Download-Chrome%20Store-4285F4?style=flat)](https://chromewebstore.google.com/detail/bhkpgjjgjgdgpbjdfhkljhcefohegooc)
[![中文](https://img.shields.io/badge/README-%E4%B8%AD%E6%96%87-4285F4?style=flat)](./docs/README.zh-TW.md)

</div>

A Chrome extension built for the ChatGPT web interface — add bookmarks, navigate with a sidebar, and send messages faster with double-press Enter. Perfect for staying organized and effortlessly revisiting key moments in long conversations.

## Feature

**Bookmark**

- Click the **bookmark button** next to any message to add or remove a bookmark
- Click a bookmark in the sidebar to **auto-scroll to the original message** and highlight it
- Supports sorting by **chat order** or **bookmark creation order**
- Add or remove custom **#hashtags** for classification
- Filter bookmarks in the sidebar by **#hashtags**
- Quick scroll buttons provide smooth scrolling to the **top / bottom** of the chat

**Quick Send While Editing Messages**

- Normally, edited messages in ChatGPT require clicking the **send button** manually
- Now you can send instantly by **double-pressing Enter**
  - `Enter` / `Shift + Enter` → New line
  - `Double Enter` → Send message

**Sidebar & Settings**

- Sidebar theme supports **Light / Dark / System** modes and remembers your preference
- Sidebar language supports **Traditional Chinese, English, Japanese** with **auto / manual switching**
- Settings page lets you **export all bookmark data** for backup purposes

## Installation

- **Official Installation (Recommended):**

  - Install directly from the Chrome Web Store: [📥 Click here to install GPT-Mark](https://chromewebstore.google.com/detail/bhkpgjjgjgdgpbjdfhkljhcefohegooc?utm_source=item-share-cb)

- **Developer Installation:**

  1. Clone this repository to your preferred directory:

     ```bash
     git clone git@github.com:DYC-DD/GPT-mark.git
     ```

  2. Open Chrome and navigate to: `chrome://extensions`
  3. Enable Developer mode (top right corner)
  4. Click Load unpacked
  5. Select the project folder you just cloned
  6. Open or refresh [ChatGPT](https://chatgpt.com/) to begin using the extension

## Demo

Below is a demonstration of ChatGPT Mark in action:

[![Watch on YouTube](https://img.shields.io/badge/YouTube-Demo%20video-red?logo=youtube)](https://youtu.be/kISToM2FhVg)

## Exported JSON Structure

The exported bookmark data is saved as a JSON file (`chatgpt_bookmarks.json`).  
A sample structure is shown below:

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
          "content": "Introduce LLM in one sentence.",
          "hashtags": ["AI"],
          "updatedAt": 1755591100546
        },
        {
          "id": "d2c2b291-9ae7-xxxxxx",
          "role": "ChatGPT",
          "content": "Large Language Models (LLMs) are trained on vast amounts of text data to understand and generate natural language.",
          "hashtags": ["AI", "ML", "DL"],
          "updatedAt": 1755591101233
        }
      ]
    }
  ]
}
```

## FAQ

| Language    | FAQ Link                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| 🇺🇸 English  | [![FAQ](https://img.shields.io/badge/FAQ-Questions-brightgreen)](https://dyc-dd.github.io/GPT-mark/?lng=en#faq) |
| 🇹🇼 繁體中文 | [![FAQ](https://img.shields.io/badge/FAQ-常見問題-blue)](https://dyc-dd.github.io/GPT-mark/?lng=zh-TW#faq)      |
| 🇯🇵 日本語   | [![FAQ](https://img.shields.io/badge/FAQ-よくある質問-orange)](https://dyc-dd.github.io/GPT-mark/?lng=ja#faq)   |

## Notes

> [!NOTE]
>
> - his extension only works on the official ChatGPT website: [ChatGPT](https://chatgpt.com/)
> - Bookmark and settings data storage:
>   - Local storage (default): saved using `chrome.storage.local`.
>   - Cross-device sync: also written to `chrome.storage.sync`, allowing automatic synchronization across Chrome browsers logged into the same Google account.
>     - Chrome’s Sync feature must be enabled, including extension data.
>     - If Sync is disabled, all data will remain local without affecting functionality.
> - All data is stored only in your Google account and local devices.
>   This extension does not upload or transmit any data to the developer or any third-party servers.

## Changelog

For the full update history, please refer to the [CHANGELOG](./docs/CHANGELOG.md)

## License

[MIT License](./LICENSE)
