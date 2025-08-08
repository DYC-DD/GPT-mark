// ========== 全域常數與工具 ==========

const EMPTY_ICON = "assets/icons/bookmarks.svg";
const FILL_ICON = "assets/icons/bookmarks-fill.svg";
const NOTEBOOK_ICON = "assets/icons/notion.svg";
const CHECK_ICON = "assets/icons/check.svg";

// ----- 時間相關常數 -----
const SCAN_INTERVAL = 2000; // 動態掃描訊息（ms）
const DOUBLE_CLICK_DELAY = 200; // Enter 雙擊間隔（ms）

console.log("ChatGPT Bookmark content script loaded! 🚀");

// ----- 主題工具 -----
function isDark() {
  return document.documentElement.classList.contains("dark");
}
function getHoverBgColor() {
  return isDark() ? "#303030" : "#E8E8E8";
}
function getIconFilter() {
  return isDark() ? "brightness(0) invert(1)" : "brightness(0)";
}

// ----- 路徑工具 -----
function normalizePath(p) {
  p = p.replace(/\/$/, "");
  const m = p.match(/^\/g\/[^/]+\/c\/([^/]+)$/);
  return m ? `/c/${m[1]}` : p;
}
function getCurrentChatKey() {
  const p = normalizePath(location.pathname);
  if (p === "/c" || /^\/g\/[^/]+\/c$/.test(location.pathname)) return null;
  return p;
}
function getCleanChatUrl(raw) {
  const m = raw.match(
    /(https?:\/\/chatgpt\.com)\/(?:g\/[^\/]+\/)?(c\/[0-9a-fA-F-]+)/
  );
  return m ? `${m[1]}/${m[2]}` : raw;
}

// ========== 編輯模式下雙擊 Enter 送出 ==========

(() => {
  let enterCount = 0;
  let timer = null;
  let sendBtn = null;

  // 判斷是否在輸入框
  function isChatInput(el) {
    if (!el) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.role === "textbox" && el.dataset.testid === "text-input")
      return true;
    if (el.classList.contains("grow-wrap")) return true;
    return el.matches?.("div.flex-grow.relative > div > textarea");
  }

  // 是否處於編輯模式
  function isEditingMode() {
    return !!document.querySelector("button.btn.relative.btn-primary");
  }

  // 找到各種可能送出按鈕
  function findSendButton() {
    return (
      document.querySelector('[data-testid="send-button"]') ||
      document.querySelector("button.btn.relative.btn-primary") ||
      document.querySelector('button[aria-label="Send message"]') ||
      document.querySelector('button[aria-label="Send"]') ||
      Array.from(document.querySelectorAll("button")).find((b) =>
        ["傳送", "Save & Submit"].some((txt) => b.textContent.includes(txt))
      )
    );
  }

  // 插入換行
  function insertNewline(textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const txt = textarea.value;
    textarea.value = txt.substring(0, start) + "\n" + txt.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + 1;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // 全域 keydown
  document.addEventListener("keydown", (e) => {
    if (!isChatInput(e.target)) {
      enterCount = 0;
      clearTimeout(timer);
      return;
    }

    const editing = isEditingMode();

    // Shift + Enter 一律換行
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      insertNewline(e.target);
      return;
    }

    // 只有編輯模式才需要雙擊送出
    if (!editing || e.key !== "Enter" || e.isComposing) return;

    e.preventDefault();
    enterCount++;

    if (enterCount === 1) {
      timer = setTimeout(() => {
        // 單擊 Enter 換行
        insertNewline(e.target);
        enterCount = 0;
      }, DOUBLE_CLICK_DELAY);
    } else if (enterCount === 2) {
      clearTimeout(timer);
      enterCount = 0;
      sendBtn = findSendButton();
      if (sendBtn) {
        sendBtn.click();
      } else {
        console.warn("GPT‑mark 找不到送出按鈕！");
      }
    }
  });
})();

// ========== 書籤功能 ==========

const STORAGE = chrome.storage.local;

// ----- 書籤資料存取 -----
function fetchBookmarks(cb) {
  const key = getCurrentChatKey();
  STORAGE.get([key], (res) => cb(res[key] || []));
}
function saveBookmarks(list) {
  const key = getCurrentChatKey();
  STORAGE.set({ [key]: list });
}
function isBookmarked(id, list) {
  return list.some((i) => i.id === id);
}
function toggleBookmark(id, content, role, cb) {
  fetchBookmarks((list) => {
    const updated = isBookmarked(id, list)
      ? list.filter((i) => i.id !== id)
      : [...list, { id, content, role }];
    saveBookmarks(updated);
    cb?.(updated);
  });
}

// ----- 建立書籤按鈕 -----
function createBookmarkButton(msgEl) {
  const id = msgEl.dataset.messageId;
  if (
    !id ||
    document.querySelector(`.chatgpt-bookmark-btn[data-bookmark-id="${id}"]`)
  )
    return null;

  const btn = document.createElement("button");
  btn.className = "chatgpt-bookmark-btn";
  btn.title = "書籤";
  btn.dataset.bookmarkId = id;
  Object.assign(btn.style, {
    width: "32px",
    height: "32px",
    background: "transparent",
    border: "none",
    borderRadius: "8px",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background-color .2s",
  });

  const icon = document.createElement("img");
  Object.assign(icon.style, {
    width: "16px",
    height: "16px",
    pointerEvents: "none",
    filter: getIconFilter(),
  });
  btn.appendChild(icon);

  // 初始狀態
  fetchBookmarks((list) => {
    icon.src = chrome.runtime.getURL(
      isBookmarked(id, list) ? FILL_ICON : EMPTY_ICON
    );
  });

  // 點擊事件
  btn.addEventListener("click", () => {
    const content = msgEl.innerText.trim();
    const role = msgEl.dataset.messageAuthorRole || "unknown";
    toggleBookmark(id, content, role, (updated) => {
      icon.src = chrome.runtime.getURL(
        isBookmarked(id, updated) ? FILL_ICON : EMPTY_ICON
      );
    });
  });
  btn.addEventListener(
    "mouseenter",
    () => (btn.style.backgroundColor = getHoverBgColor())
  );
  btn.addEventListener(
    "mouseleave",
    () => (btn.style.backgroundColor = "transparent")
  );

  return btn;
}

// ========== Notion 筆記功能 ==========

// ----- code block 支援語言 -----
const NOTION_CODE_LANGUAGES = new Set([
  "abap",
  "abc",
  "agda",
  "arduino",
  "ascii art",
  "assembly",
  "bash",
  "basic",
  "bnf",
  "c",
  "c#",
  "c++",
  "clojure",
  "coffeescript",
  "coq",
  "css",
  "dart",
  "dhall",
  "diff",
  "docker",
  "ebnf",
  "elixir",
  "elm",
  "erlang",
  "f#",
  "flow",
  "fortran",
  "gherkin",
  "glsl",
  "go",
  "graphql",
  "groovy",
  "haskell",
  "hcl",
  "html",
  "idris",
  "java",
  "javascript",
  "json",
  "julia",
  "kotlin",
  "latex",
  "less",
  "lisp",
  "livescript",
  "llvm ir",
  "lua",
  "makefile",
  "markdown",
  "markup",
  "matlab",
  "mathematica",
  "mermaid",
  "nix",
  "notion formula",
  "objective-c",
  "ocaml",
  "pascal",
  "perl",
  "php",
  "plain text",
  "powershell",
  "prolog",
  "protobuf",
  "purescript",
  "python",
  "r",
  "racket",
  "reason",
  "ruby",
  "rust",
  "sass",
  "scala",
  "scheme",
  "scss",
  "shell",
  "smalltalk",
  "solidity",
  "sql",
  "swift",
  "toml",
  "typescript",
  "vb.net",
  "verilog",
  "vhdl",
  "visual basic",
  "webassembly",
  "xml",
  "yaml",
]);

// ----- HTML 轉 Notion Blocks (GPT 訊息用) -----
function htmlToBlocksFromElement(el) {
  const blocks = [];
  const processedLists = new WeakSet();
  const processedNodes = new WeakSet();
  const nodes = el.querySelectorAll(
    "table,hr,h1,h2,h3,h4,h5,h6,p,blockquote,ul,ol,li,pre,code[class*='language-']"
  );

  // 將容器轉為 rich_text：保留 <a href> 連結
  function buildRichTextFromNode(container) {
    const segments = [];

    function walk(node) {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        if (text.length)
          segments.push({ type: "text", text: { content: text } });
        return;
      }
      if (!(node instanceof HTMLElement)) return;

      if (node.tagName === "A" && node.href) {
        const linkText = node.textContent || node.href;
        segments.push({
          type: "text",
          text: { content: linkText, link: { url: node.href } },
        });
        return;
      }

      Array.from(node.childNodes).forEach(walk);
    }

    walk(container);
    const fallback = (container.textContent || "").trim();
    return segments.length
      ? segments
      : fallback
      ? [{ type: "text", text: { content: fallback } }]
      : [];
  }

  // 將 <ul>/<ol> 轉為 Notion blocks，保留巢狀結構
  function parseList(listEl) {
    processedLists.add(listEl);
    const listType =
      listEl.nodeName === "OL" ? "numbered_list_item" : "bulleted_list_item";
    const items = [];

    const liNodes = Array.from(listEl.querySelectorAll(":scope > li"));
    liNodes.forEach((li) => {
      // 取得 li 主要文字（優先取直屬 <p>，避免包含子清單文字）
      const p = li.querySelector(":scope > p");
      let rich = [];
      if (p) {
        rich = buildRichTextFromNode(p);
      } else {
        // 取直屬內容（排除子清單）
        const clone = li.cloneNode(true);
        clone
          .querySelectorAll(":scope > ul, :scope > ol")
          .forEach((n) => n.remove());
        rich = buildRichTextFromNode(clone);
      }
      if (!rich.length) return;

      const block = {
        object: "block",
        type: listType,
        [listType]: { rich_text: rich },
      };

      // 依照實際 DOM 順序蒐集子節點（含標題、段落、子清單、程式碼、分隔）
      const children = [];
      const usedP = p || null;
      Array.from(li.childNodes).forEach((child) => {
        if (!(child instanceof HTMLElement)) return;
        if (child === usedP) {
          processedNodes.add(child);
          return;
        }
        const ctag = child.nodeName;
        // 子清單
        if (ctag === "UL" || ctag === "OL") {
          if (!processedLists.has(child)) {
            children.push(...parseList(child));
          }
          processedNodes.add(child);
          return;
        }
        // 分隔線
        if (ctag === "HR") {
          children.push({ object: "block", type: "divider", divider: {} });
          processedNodes.add(child);
          return;
        }
        // 標題（預設 H3 之下都映射為 heading_3）
        if (
          ctag === "H1" ||
          ctag === "H2" ||
          ctag === "H3" ||
          ctag === "H4" ||
          ctag === "H5" ||
          ctag === "H6"
        ) {
          const headingType =
            ctag === "H1"
              ? "heading_1"
              : ctag === "H2"
              ? "heading_2"
              : "heading_3";
          const rich = buildRichTextFromNode(child);
          if (rich.length) {
            children.push({
              object: "block",
              type: headingType,
              [headingType]: { rich_text: rich },
            });
          }
          processedNodes.add(child);
          return;
        }
        // 段落/引言
        if (ctag === "P" || ctag === "BLOCKQUOTE") {
          const type = ctag === "BLOCKQUOTE" ? "quote" : "paragraph";
          const rich = buildRichTextFromNode(child);
          if (rich.length)
            children.push({
              object: "block",
              type,
              [type]: { rich_text: rich },
            });
          processedNodes.add(child);
          return;
        }
        // 程式碼區塊 <pre><code/>
        if (ctag === "PRE") {
          const codeNode = child.querySelector("code");
          let codeText = codeNode ? codeNode.textContent : child.textContent;
          let lang = "plain text";
          if (codeNode) {
            const cls = Array.from(codeNode.classList).find((c) =>
              c.startsWith("language-")
            );
            if (cls) {
              lang = cls.replace(/^language-/, "").toLowerCase();
              if (lang === "js") lang = "javascript";
              if (!NOTION_CODE_LANGUAGES.has(lang)) lang = "plain text";
            }
          }
          const segments = [];
          let buf = "";
          codeText.split("\n").forEach((line) => {
            if (buf.length + line.length + 1 > 2000) {
              segments.push(buf);
              buf = "";
            }
            buf += (buf ? "\n" : "") + line;
          });
          if (buf) segments.push(buf);
          children.push({
            object: "block",
            type: "code",
            code: {
              language: lang,
              rich_text: segments.map((txt) => ({
                type: "text",
                text: { content: txt },
              })),
            },
          });
          processedNodes.add(child);
          return;
        }
        // <code class="language-xxx"> 區塊（非 inline）
        if (
          ctag === "CODE" &&
          Array.from(child.classList).some((c) => c.startsWith("language-"))
        ) {
          if (child.closest("pre")) {
            processedNodes.add(child);
            return;
          }
          let lang = Array.from(child.classList)
            .find((c) => c.startsWith("language-"))
            .replace(/^language-/, "")
            .toLowerCase();
          if (lang === "js") lang = "javascript";
          if (!NOTION_CODE_LANGUAGES.has(lang)) lang = "plain text";
          const codeText = child.textContent;
          const segments = [];
          let buf = "";
          codeText.split("\n").forEach((line) => {
            if (buf.length + line.length + 1 > 2000) {
              segments.push(buf);
              buf = "";
            }
            buf += (buf ? "\n" : "") + line;
          });
          if (buf) segments.push(buf);
          children.push({
            object: "block",
            type: "code",
            code: {
              language: lang,
              rich_text: segments.map((txt) => ({
                type: "text",
                text: { content: txt },
              })),
            },
          });
          processedNodes.add(child);
          return;
        }
      });
      if (children.length) {
        block[listType].children = children;
      }

      items.push(block);
    });

    return items;
  }

  nodes.forEach((node) => {
    if (processedNodes.has(node)) return;
    const tag = node.nodeName;

    // (2.5) 處理 <pre> 區塊（有時候 code block 是 <pre><code>…</code></pre>）
    if (tag === "PRE") {
      // 取出裡面的 code 或直接用 textContent
      const codeNode = node.querySelector("code");
      let codeText = codeNode ? codeNode.textContent : node.textContent;
      let lang = "plain text";
      if (codeNode) {
        // 如果 <code> 有 language-xxx，取出並轉小寫
        const cls = Array.from(codeNode.classList).find((c) =>
          c.startsWith("language-")
        );
        if (cls) {
          lang = cls.replace(/^language-/, "").toLowerCase();
          if (lang === "js") lang = "javascript";
          if (!NOTION_CODE_LANGUAGES.has(lang)) lang = "plain text";
        }
      }
      // 同樣做 2000 字切段
      const segments = [];
      let buf = "";
      codeText.split("\n").forEach((line) => {
        if (buf.length + line.length + 1 > 2000) {
          segments.push(buf);
          buf = "";
        }
        buf += (buf ? "\n" : "") + line;
      });
      if (buf) segments.push(buf);

      blocks.push({
        object: "block",
        type: "code",
        code: {
          language: lang,
          rich_text: segments.map((txt) => ({
            type: "text",
            text: { content: txt },
          })),
        },
      });
      return;
    }

    // (1) inline code (未指定語言) 跳過
    if (
      tag === "CODE" &&
      !Array.from(node.classList).some((c) => c.startsWith("language-"))
    )
      return;

    // (2) 表格（保留儲存格中的連結）
    if (tag === "TABLE") {
      const headerCells = Array.from(node.querySelectorAll("thead tr th")).map(
        (th) => buildRichTextFromNode(th)
      );
      const bodyRows = Array.from(node.querySelectorAll("tbody tr"));
      const children = [];

      // 標題列
      if (headerCells.length) {
        children.push({
          object: "block",
          type: "table_row",
          table_row: {
            cells: headerCells.map((rt) =>
              rt.length ? rt : [{ type: "text", text: { content: "" } }]
            ),
          },
        });
      }
      // 資料列
      bodyRows.forEach((tr) => {
        const cellRichTexts = Array.from(tr.querySelectorAll("td")).map((td) =>
          buildRichTextFromNode(td)
        );
        children.push({
          object: "block",
          type: "table_row",
          table_row: {
            cells: cellRichTexts.map((rt) =>
              rt.length ? rt : [{ type: "text", text: { content: "" } }]
            ),
          },
        });
      });

      // 決定表格寬度
      let tableWidth = headerCells.length;
      if (!tableWidth && bodyRows.length) {
        const first = bodyRows[0];
        tableWidth = first ? first.querySelectorAll("td").length : 0;
      }
      tableWidth = tableWidth || 1;

      blocks.push({
        object: "block",
        type: "table",
        table: {
          table_width: tableWidth,
          has_column_header: !!headerCells.length,
          has_row_header: false,
          children,
        },
      });
      return;
    }

    // (3) 分隔線
    if (tag === "HR") {
      blocks.push({ object: "block", type: "divider", divider: {} });
      return;
    }

    // (4) 程式碼區塊
    if (
      tag === "CODE" &&
      Array.from(node.classList).some((c) => c.startsWith("language-"))
    ) {
      if (node.closest("pre")) return;
      let lang = Array.from(node.classList)
        .find((c) => c.startsWith("language-"))
        .replace(/^language-/, "")
        .toLowerCase();
      if (lang === "js") lang = "javascript";
      if (!NOTION_CODE_LANGUAGES.has(lang)) lang = "plain text";

      // code block 最多 2000 字切段
      const codeText = node.textContent;
      const segments = [];
      let buf = "";
      codeText.split("\n").forEach((line) => {
        if (buf.length + line.length + 1 > 2000) {
          segments.push(buf);
          buf = "";
        }
        buf += (buf ? "\n" : "") + line;
      });
      if (buf) segments.push(buf);

      blocks.push({
        object: "block",
        type: "code",
        code: {
          language: lang,
          rich_text: segments.map((txt) => ({
            type: "text",
            text: { content: txt },
          })),
        },
      });
      return;
    }

    // (5) 列表容器：一次處理整個清單並保留巢狀
    if (tag === "UL" || tag === "OL") {
      if (processedLists.has(node)) return;
      blocks.push(...parseList(node));
      return;
    }

    // (6) 列表項目：改由 (5) 的列表容器處理，這裡跳過避免重複
    if (tag === "LI") return;

    // (7) 列表內段落 <p> 不重複處理；blockquote 內的 <p> 也跳過，避免重複
    if (tag === "P" && (node.closest("li") || node.closest("blockquote")))
      return;

    // (8) 其他文字節點
    const txt = node.textContent.trim();
    if (!txt) return;

    switch (tag) {
      case "H1":
        blocks.push(makeHeading("heading_1", txt));
        break;
      case "H2":
        blocks.push(makeHeading("heading_2", txt));
        break;
      case "H3":
      case "H4":
      case "H5":
      case "H6":
        blocks.push(makeHeading("heading_3", txt));
        break;
      case "BLOCKQUOTE":
        blocks.push({
          object: "block",
          type: "quote",
          quote: { rich_text: [{ type: "text", text: { content: txt } }] },
        });
        break;
      default:
        blocks.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: txt } }] },
        });
    }
  });

  return blocks;
}
function makeHeading(type, text) {
  return {
    object: "block",
    type,
    [type]: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

// ----- 建立 Notebook 按鈕 -----
function createNotebookButton(msgEl) {
  const id = msgEl.dataset.messageId;
  if (
    !id ||
    document.querySelector(`.chatgpt-notebook-btn[data-notebook-id="${id}"]`)
  )
    return null;

  const btn = document.createElement("button");
  btn.className = "chatgpt-notebook-btn";
  btn.title = "筆記到 Notion";
  btn.dataset.notebookId = id;
  Object.assign(btn.style, {
    width: "32px",
    height: "32px",
    background: "transparent",
    border: "none",
    borderRadius: "8px",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background-color .2s",
  });

  const icon = document.createElement("img");
  Object.assign(icon.style, {
    width: "16px",
    height: "16px",
    pointerEvents: "none",
    filter: getIconFilter(),
  });
  icon.src = chrome.runtime.getURL(NOTEBOOK_ICON);
  btn.appendChild(icon);

  let disabled = false;

  btn.addEventListener("click", () => {
    if (disabled) return;
    disabled = true;
    icon.src = chrome.runtime.getURL(CHECK_ICON);

    const pageUrl = getCleanChatUrl(location.href);
    const blocks = [
      { object: "block", type: "divider", divider: {} },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: pageUrl, link: { url: pageUrl } },
            },
          ],
        },
      },
    ];

    // 根據作者角色加入內容
    const role = msgEl.dataset.messageAuthorRole;
    if (role === "user") {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            { type: "text", text: { content: msgEl.innerText.trim() } },
          ],
        },
      });
    } else {
      blocks.push(...htmlToBlocksFromElement(msgEl));
    }

    chrome.storage.local.get(
      ["notion-integration-token", "notion-page-id"],
      ({ "notion-integration-token": token, "notion-page-id": pageId }) => {
        if (!token || !pageId) {
          alert("請先設定 Notion Token & Page ID");
          reset();
          return;
        }
        chrome.runtime.sendMessage(
          { action: "appendBlocks", pageId, blocks },
          (res) => {
            if (res.success) {
              reset();
            } else {
              if (res.error && res.error.includes("401")) {
                alert("Notion 連線失敗：請檢查 Integration Token 或 Page ID");
              } else {
                alert(`Notion 連線失敗：${res.error}`);
              }
              reset();
            }
          }
        );
      }
    );

    function reset() {
      setTimeout(() => {
        icon.src = chrome.runtime.getURL(NOTEBOOK_ICON);
        disabled = false;
      }, 3000);
    }
  });

  btn.addEventListener(
    "mouseenter",
    () => (btn.style.backgroundColor = getHoverBgColor())
  );
  btn.addEventListener(
    "mouseleave",
    () => (btn.style.backgroundColor = "transparent")
  );

  return btn;
}

// ========== 滾動控制（定位 / 最上 / 最下） ==========

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // 定位到特定訊息並高亮
  if (msg.type === "scrollToMessage") {
    const el = document.querySelector(`[data-message-id="${msg.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.style.transition = "background-color 0.5s";
      el.style.backgroundColor = "#ffff99";
      setTimeout(() => (el.style.backgroundColor = ""), 1000);
    }
    sendResponse?.({ result: "scrolled" });
  }

  // 側邊欄按鈕：最上 / 最下
  const container = document.querySelector("main div[class*='overflow-y']");
  if (!container) return;

  if (msg.type === "scroll-to-top") {
    container.scrollTo({ top: 0, behavior: "smooth" });
  } else if (msg.type === "scroll-to-bottom") {
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }
});

// ----- 提供訊息排序給側邊欄 -----
chrome.runtime.onMessage.addListener((msg, _s, sendResp) => {
  if (msg.type !== "getChatOrder") return;
  const nodes = document.querySelectorAll(
    '[data-message-author-role="user"][data-message-id],' +
      '[data-message-author-role="assistant"][data-message-id]'
  );
  sendResp({
    order: Array.from(nodes).map((n) => n.dataset.messageId),
  });
});

// ========== 啟動流程：注入按鈕 / 監聽 DOM & 路由 / 主題變換 ==========

function injectButtonsForMessage(msgEl) {
  // 書籤
  const bookmarkBtn = createBookmarkButton(msgEl);
  if (!bookmarkBtn) return;

  // 目標插入點：複製按鈕旁
  const article = msgEl.closest("article");
  const copyBtn = article?.querySelector(
    '[data-testid="copy-turn-action-button"]'
  );

  if (copyBtn?.parentNode) {
    // 書籤
    copyBtn.parentNode.insertBefore(bookmarkBtn, copyBtn);
    // Notebook
    const notebookBtn = createNotebookButton(msgEl);
    notebookBtn &&
      copyBtn.parentNode.insertBefore(notebookBtn, bookmarkBtn.nextSibling);
  } else {
    // 複製按鈕還沒渲染好 等待後再試一次
    setTimeout(() => injectButtonsForMessage(msgEl), 500);
  }
}

// 已有訊息
function injectExisting() {
  document
    .querySelectorAll("[data-message-id]")
    .forEach(injectButtonsForMessage);
}

// 動態訊息
function observeTurns() {
  const obs = new MutationObserver((muts) => {
    muts.forEach((m) =>
      m.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const msg = node.matches?.("[data-message-id]")
          ? node
          : node.querySelector?.("[data-message-id]");
        msg && injectButtonsForMessage(msg);
      })
    );
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

// 主題切換時更新 icon 濾鏡
function observeTheme() {
  const obs = new MutationObserver(() => {
    const filter = getIconFilter();
    document
      .querySelectorAll(".chatgpt-bookmark-btn img, .chatgpt-notebook-btn img")
      .forEach((img) => (img.style.filter = filter));
  });
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

// 路由變動 (pushState / replaceState / popstate)
(function (Hist) {
  ["pushState", "replaceState"].forEach((fn) => {
    const orig = Hist[fn];
    Hist[fn] = function () {
      const ret = orig.apply(this, arguments);
      window.dispatchEvent(new Event("gptmark-location-change"));
      return ret;
    };
  });
})(history);

let lastPath = location.pathname;
function onRouteChange() {
  if (location.pathname === lastPath) return;
  lastPath = location.pathname;
  setTimeout(() => {
    injectExisting();
    fetchBookmarks((list) => {
      document.querySelectorAll(".chatgpt-bookmark-btn").forEach((btn) => {
        const id = btn.dataset.bookmarkId;
        const icon = btn.firstElementChild;
        icon.src = chrome.runtime.getURL(
          isBookmarked(id, list) ? FILL_ICON : EMPTY_ICON
        );
      });
    });
  }, 600);
}
window.addEventListener("gptmark-location-change", onRouteChange);
window.addEventListener("popstate", onRouteChange);

// -------- 啟動 --------
window.addEventListener("load", () => {
  injectExisting();
  observeTurns();
  observeTheme();
  setInterval(injectExisting, SCAN_INTERVAL);
  chrome.runtime.sendMessage({ type: "chatgpt-ready" });
});
