// ================== GPT-Mark content.js (merged: main LTS + Notion) ==================

console.log("ChatGPT Bookmark 插件已載入！（merged with Notion）");

// ---------- 常數 ----------
const SCAN_INTERVAL = 2000; // 動態載入掃描間隔
const EMPTY_ICON = "assets/icons/bookmarks.svg";
const FILL_ICON = "assets/icons/bookmarks-fill.svg";
const NOTEBOOK_ICON = "assets/icons/notion.svg";
const CHECK_ICON = "assets/icons/check.svg";

// ---------- 編輯下 Enter 雙擊送出（沿用 main LTS） ----------
let sendButton = null;
let enterPressCount = 0;
let enterPressTimer = null;
const DOUBLE_CLICK_DELAY = 200;

function isChatInput(target) {
  if (!target) return false;
  if (target.tagName === "TEXTAREA") return true;
  if (target.role === "textbox" && target.dataset.testid === "text-input")
    return true;
  if (target.classList?.contains("grow-wrap")) return true;
  if (target.matches?.("div.flex-grow.relative > div > textarea")) return true;
  return false;
}

function isEditingMode() {
  return !!document.querySelector("button.btn.relative.btn-primary");
}

function findSendButton() {
  let button = document.querySelector('[data-testid="send-button"]');
  if (button) return button;
  button = document.querySelector("button.btn.relative.btn-primary");
  if (button) return button;
  button = document.querySelector('button[aria-label="Send message"]');
  if (button) return button;
  button = document.querySelector('button[aria-label="Send"]');
  if (button) return button;
  for (const btn of document.querySelectorAll("button")) {
    if (
      btn.textContent?.includes("傳送") ||
      btn.textContent?.includes("Save & Submit")
    )
      return btn;
  }
  return null;
}

function insertNewline(targetElement) {
  if (!targetElement) return;
  const start = targetElement.selectionStart;
  const end = targetElement.selectionEnd;
  const text = targetElement.value;
  targetElement.value = text.substring(0, start) + "\n" + text.substring(end);
  targetElement.selectionStart = targetElement.selectionEnd = start + 1;
  targetElement.dispatchEvent(new Event("input", { bubbles: true }));
}

document.addEventListener("keydown", (event) => {
  const t = event.target;
  if (!isChatInput(t)) {
    enterPressCount = 0;
    clearTimeout(enterPressTimer);
    enterPressTimer = null;
    return;
  }

  const editing = isEditingMode();

  // Shift+Enter 一律換行
  if (event.key === "Enter" && event.shiftKey) {
    event.preventDefault();
    insertNewline(t);
    enterPressCount = 0;
    clearTimeout(enterPressTimer);
    enterPressTimer = null;
    return;
  }

  if (!editing) {
    enterPressCount = 0;
    clearTimeout(enterPressTimer);
    enterPressTimer = null;
    return;
  }

  // 編輯模式：單擊換行、雙擊送出
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    enterPressCount++;

    if (enterPressCount === 1) {
      enterPressTimer = setTimeout(() => {
        if (enterPressCount === 1) insertNewline(t);
        enterPressCount = 0;
        enterPressTimer = null;
      }, DOUBLE_CLICK_DELAY);
    } else if (enterPressCount === 2) {
      clearTimeout(enterPressTimer);
      enterPressCount = 0;
      enterPressTimer = null;

      sendButton = findSendButton();
      if (sendButton) {
        sendButton.click();
      } else {
        console.warn("ChatGPT：編輯模式 - 未找到發送按鈕。");
      }
    }
  }
});

// ---------- 工具：主題/路徑 ----------
function getHoverBgColor() {
  return document.documentElement.classList.contains("dark")
    ? "#303030"
    : "#E8E8E8";
}
function getIconFilter() {
  return document.documentElement.classList.contains("dark")
    ? "brightness(0) invert(1)"
    : "brightness(0)";
}

// 將任意 /g/.../c/<chatId> 或 /c/<chatId>/ 統一為 /c/<chatId>
function normalizePath(p) {
  p = p.replace(/\/$/, "");
  const m = p.match(/^\/g\/[^/]+\/c\/([^/]+)$/);
  if (m) return `/c/${m[1]}`;
  return p;
}

// 回傳目前聊天室的 storage key（或 null）
function getCurrentChatKey() {
  const p = normalizePath(window.location.pathname);
  if (p === "/c" || /^\/g\/[^/]+\/c$/.test(window.location.pathname))
    return null;
  return p;
}

// 轉成乾淨 chat 連結（給 Notion 記錄來源）
function getCleanChatUrl(raw) {
  const m = raw.match(
    /(https?:\/\/chatgpt\.com)\/(?:g\/[^\/]+\/)?(c\/[0-9a-fA-F-]+)/
  );
  return m ? `${m[1]}/${m[2]}` : raw;
}

// ---- 舊資料一次性搬家：把 /g/.../c/<id> → /c/<id> ----
chrome.storage.local.get(null, (all) => {
  Object.entries(all || {}).forEach(([k, v]) => {
    const m = k.match(/^\/g\/[^/]+\/c\/([^/]+)\/?$/);
    if (m) {
      const target = `/c/${m[1]}`;
      if (!(target in all)) {
        chrome.storage.local.set({ [target]: v }, () =>
          chrome.storage.local.remove(k)
        );
      }
    }
  });
});

// ---------- dual-storage 書籤（沿用 main LTS） ----------
function fetchBookmarks(cb) {
  const key = getCurrentChatKey();
  if (!key) return cb([]);
  dualRead(key).then((list) => cb(list));
}
function saveBookmarks(list) {
  const key = getCurrentChatKey();
  if (!key) return;
  dualSet(key, list);
}
function isBookmarked(id, list) {
  return list.some((it) => it.id === id && !it.deleted);
}
function toggleBookmark(id, content, role, cb) {
  const key = getCurrentChatKey();
  dualRead(key).then((list) => {
    const now = Date.now();
    const idx = list.findIndex((it) => it.id === id);
    let updated;

    if (idx >= 0) {
      const cur = withDefaults(list[idx]); // 由 dual-storage.js 提供
      const willDelete = !cur.deleted;
      const resurrecting = !willDelete;
      updated = list.map((it, i) => {
        if (i !== idx) return it;
        return {
          ...cur,
          deleted: willDelete,
          hashtags: resurrecting ? [] : cur.hashtags,
          createdAt: resurrecting ? now : cur.createdAt || now,
          updatedAt: now,
        };
      });
    } else {
      updated = [
        ...list,
        {
          id,
          content,
          role,
          hashtags: [],
          deleted: false,
          createdAt: now,
          updatedAt: now,
        },
      ];
    }

    saveBookmarks(updated);
    cb && cb(updated);
  });
}

// ---------- 建立「書籤」按鈕（沿用 main LTS） ----------
function createBookmarkButton(msg) {
  const id = msg?.dataset?.messageId;
  if (
    !id ||
    document.querySelector(`.chatgpt-bookmark-btn[data-bookmark-id="${id}"]`)
  )
    return null;

  const btn = document.createElement("button");
  btn.className = "chatgpt-bookmark-btn";
  btn.title = "書籤";
  btn.setAttribute("data-bookmark-id", id);
  Object.assign(btn.style, {
    width: "32px",
    height: "32px",
    background: "transparent",
    border: "none",
    borderRadius: "8px",
    padding: "0",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background-color 0.2s",
  });

  const icon = document.createElement("img");
  Object.assign(icon.style, {
    width: "16px",
    height: "16px",
    pointerEvents: "none",
    filter: getIconFilter(),
  });
  btn.appendChild(icon);

  const key = getCurrentChatKey();
  dualRead(key).then((list) => {
    const file = isBookmarked(id, list) ? FILL_ICON : EMPTY_ICON;
    icon.src = chrome.runtime.getURL(file);
  });

  btn.addEventListener("click", () => {
    const content = msg.innerText.trim();
    const role = msg.dataset.messageAuthorRole || "unknown";
    toggleBookmark(id, content, role, (updated) => {
      const file = isBookmarked(id, updated) ? FILL_ICON : EMPTY_ICON;
      icon.src = chrome.runtime.getURL(file);
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

// ================== Notion：HTML → Blocks（新增） ==================
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

function makeHeading(type, text) {
  return {
    object: "block",
    type,
    [type]: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

// 專供「助理訊息」使用：把訊息 DOM 轉為 Notion blocks
function htmlToBlocksFromElement(el) {
  const blocks = [];
  const processedLists = new WeakSet();
  const processedNodes = new WeakSet();
  const nodes = el.querySelectorAll(
    "table,hr,h1,h2,h3,h4,h5,h6,p,blockquote,ul,ol,li,pre,code[class*='language-']"
  );

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

  function parseList(listEl) {
    processedLists.add(listEl);
    const listType =
      listEl.nodeName === "OL" ? "numbered_list_item" : "bulleted_list_item";
    const items = [];
    const liNodes = Array.from(listEl.querySelectorAll(":scope > li"));

    liNodes.forEach((li) => {
      const p = li.querySelector(":scope > p");
      let rich = [];
      if (p) {
        rich = buildRichTextFromNode(p);
      } else {
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
      const children = [];
      const usedP = p || null;

      Array.from(li.childNodes).forEach((child) => {
        if (!(child instanceof HTMLElement)) return;
        if (child === usedP) {
          processedNodes.add(child);
          return;
        }
        const ctag = child.nodeName;

        if (ctag === "UL" || ctag === "OL") {
          if (!processedLists.has(child)) children.push(...parseList(child));
          processedNodes.add(child);
          return;
        }
        if (ctag === "HR") {
          children.push({ object: "block", type: "divider", divider: {} });
          processedNodes.add(child);
          return;
        }
        if (/^H[1-6]$/.test(ctag)) {
          const headingType =
            ctag === "H1"
              ? "heading_1"
              : ctag === "H2"
              ? "heading_2"
              : "heading_3";
          const richH = buildRichTextFromNode(child);
          if (richH.length)
            children.push({
              object: "block",
              type: headingType,
              [headingType]: { rich_text: richH },
            });
          processedNodes.add(child);
          return;
        }
        if (ctag === "P" || ctag === "BLOCKQUOTE") {
          const type = ctag === "BLOCKQUOTE" ? "quote" : "paragraph";
          const richP = buildRichTextFromNode(child);
          if (richP.length)
            children.push({
              object: "block",
              type,
              [type]: { rich_text: richP },
            });
          processedNodes.add(child);
          return;
        }
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
          (codeText || "").split("\n").forEach((line) => {
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
          const codeText = child.textContent || "";
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

      if (children.length) block[listType].children = children;
      items.push(block);
    });

    return items;
  }

  nodes.forEach((node) => {
    if (processedNodes.has(node)) return;
    const tag = node.nodeName;

    if (tag === "PRE") {
      const codeNode = node.querySelector("code");
      let codeText = codeNode ? codeNode.textContent : node.textContent;
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
      (codeText || "").split("\n").forEach((line) => {
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

    // 跳過 inline <code>（沒有語言）
    if (
      tag === "CODE" &&
      !Array.from(node.classList).some((c) => c.startsWith("language-"))
    )
      return;

    // 表格
    if (tag === "TABLE") {
      const headerCells = Array.from(node.querySelectorAll("thead tr th")).map(
        (th) => buildRichTextFromNode(th)
      );
      const bodyRows = Array.from(node.querySelectorAll("tbody tr"));
      const children = [];

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

    if (tag === "HR") {
      blocks.push({ object: "block", type: "divider", divider: {} });
      return;
    }

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

      const codeText = node.textContent || "";
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

    if (tag === "UL" || tag === "OL") {
      if (processedLists.has(node)) return;
      blocks.push(...parseList(node));
      return;
    }

    if (tag === "LI") return;

    if (tag === "P" && (node.closest("li") || node.closest("blockquote")))
      return;

    const txt = (node.textContent || "").trim();
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

// ---------- 建立「Notebook → Notion」按鈕（新增） ----------
function createNotebookButton(msgEl) {
  const id = msgEl?.dataset?.messageId;
  if (
    !id ||
    document.querySelector(`.chatgpt-notebook-btn[data-notebook-id="${id}"]`)
  )
    return null;

  const btn = document.createElement("button");
  btn.className = "chatgpt-notebook-btn";
  btn.title = "筆記到 Notion";
  btn.setAttribute("data-notebook-id", id);
  Object.assign(btn.style, {
    width: "32px",
    height: "32px",
    background: "transparent",
    border: "none",
    borderRadius: "8px",
    padding: "0",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background-color 0.2s",
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
      (cfg) => {
        const token = cfg["notion-integration-token"];
        const pageId = cfg["notion-page-id"];
        if (!token || !pageId) {
          alert("請先在設定頁填好 Notion Token 與 Page ID");
          return reset();
        }
        chrome.runtime.sendMessage(
          { action: "appendBlocks", pageId, blocks },
          (res) => {
            if (res?.success) {
              reset();
            } else {
              const msg = res?.error || "unknown error";
              if (String(msg).includes("401"))
                alert("Notion 連線失敗：請檢查 Integration Token 或 Page ID");
              else alert(`Notion 連線失敗：${msg}`);
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

// ---------- 注入兩顆按鈕（改良：在 main 的 tryInjectButton 基礎上同時插入 Notebook） ----------
const _scheduledInjects = new Map();
function tryInjectButton(msg) {
  const id = msg?.dataset?.messageId;
  if (!id) return;

  const insertNow = () => {
    // 已插入就算成功
    if (
      document.querySelector(
        `.chatgpt-bookmark-btn[data-bookmark-id="${id}"]`
      ) &&
      document.querySelector(`.chatgpt-notebook-btn[data-notebook-id="${id}"]`)
    ) {
      return true;
    }

    const curMsg =
      document.querySelector(`[data-message-id="${CSS.escape(id)}"]`) || msg;
    const turn = curMsg?.closest("article");
    if (!turn) return false;

    const copyBtn = turn.querySelector(
      '[data-testid="copy-turn-action-button"]'
    );
    if (!copyBtn || !copyBtn.parentNode) return false;

    // 書籤
    if (
      !document.querySelector(`.chatgpt-bookmark-btn[data-bookmark-id="${id}"]`)
    ) {
      const bbtn = createBookmarkButton(curMsg);
      if (bbtn) copyBtn.parentNode.insertBefore(bbtn, copyBtn);
    }
    // Notebook（插在書籤之後）
    if (
      !document.querySelector(`.chatgpt-notebook-btn[data-notebook-id="${id}"]`)
    ) {
      const nbtn = createNotebookButton(curMsg);
      const bookmarkBtn = document.querySelector(
        `.chatgpt-bookmark-btn[data-bookmark-id="${id}"]`
      );
      if (nbtn && bookmarkBtn && bookmarkBtn.parentNode) {
        bookmarkBtn.parentNode.insertBefore(nbtn, bookmarkBtn.nextSibling);
      } else if (nbtn) {
        copyBtn.parentNode.insertBefore(nbtn, copyBtn);
      }
    }

    return true;
  };

  if (insertNow()) return;
  if (_scheduledInjects.has(id)) return;

  let attempts = 5;
  const intervalId = setInterval(() => {
    if (insertNow() || --attempts === 0) {
      clearInterval(intervalId);
      _scheduledInjects.delete(id);
    }
  }, 120);

  _scheduledInjects.set(id, intervalId);
}

// 為目前頁面所有已渲染的訊息注入兩顆按鈕
function injectExistingActions() {
  document
    .querySelectorAll("[data-message-id]")
    .forEach((msg) => tryInjectButton(msg));
}

// 監聽新加入的 turn 節點，自動插入兩顆按鈕（沿用 main 的監聽骨架）
function observeAllTurns() {
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        if (node.matches?.('[data-testid="copy-turn-action-button"]')) {
          const turn = node.closest("article");
          const msg = turn?.querySelector("[data-message-id]");
          if (msg) tryInjectButton(msg);
          continue;
        }

        const copyBtn = node.querySelector?.(
          '[data-testid="copy-turn-action-button"]'
        );
        if (copyBtn) {
          const turn = copyBtn.closest("article");
          const msg = turn?.querySelector("[data-message-id]");
          if (msg) tryInjectButton(msg);
          continue;
        }

        const msgNode = node.matches?.("[data-message-id]")
          ? node
          : node.querySelector?.("[data-message-id]");
        if (msgNode) {
          const turn = msgNode.closest("article");
          const btnArea = turn?.querySelector(
            '[data-testid="copy-turn-action-button"]'
          );
          if (btnArea) tryInjectButton(msgNode);
        }
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-message-id"],
  });
}

// ---------- 主題切換時更新 icon 濾鏡 ----------
function updateActionIcons() {
  const filter = getIconFilter();
  document
    .querySelectorAll(".chatgpt-bookmark-btn img, .chatgpt-notebook-btn img")
    .forEach((icon) => (icon.style.filter = filter));
}
function observeMoodChange() {
  const observer = new MutationObserver(() => updateActionIcons());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

// ---------- 書籤圖示（實際檔案：空心/實心）刷新 ----------
function refreshBookmarkIcons() {
  const key = getCurrentChatKey();
  dualRead(key).then((list) => {
    document.querySelectorAll(".chatgpt-bookmark-btn").forEach((btn) => {
      const id = btn.dataset.bookmarkId;
      const icon = btn.firstElementChild;
      const file = isBookmarked(id, list) ? FILL_ICON : EMPTY_ICON;
      icon.src = chrome.runtime.getURL(file);
    });
  });
}

// ---------- 高亮樣式與滾動定位（沿用 main） ----------
(function injectHighlightStyle() {
  if (document.getElementById("gptmark-highlight-style")) return;
  const style = document.createElement("style");
  style.id = "gptmark-highlight-style";
  style.textContent = `
    .gptmark-highlight {
      position: relative;
      outline: 2px solid rgba(0, 89, 255, 0.9);
      outline-offset: 0px;
      background-color: rgba(138, 161, 229, 0.25);
      transition: outline-color 1s ease, background-color 1s ease, box-shadow 1s ease;
    }
    .gptmark-highlight.fadeout {
      outline-color: transparent;
      background-color: transparent;
      box-shadow: none;
    }
  `;
  document.head.appendChild(style);
})();

const _highlightTimers = new WeakMap();
function highlightMessage(msgElem) {
  const timers = _highlightTimers.get(msgElem);
  if (timers) {
    clearTimeout(timers.fadeTimer);
    clearTimeout(timers.clearTimer);
  }
  msgElem.classList.remove("gptmark-highlight", "fadeout");
  // 觸發 reflow
  // eslint-disable-next-line no-unused-expressions
  msgElem.offsetWidth;
  msgElem.classList.add("gptmark-highlight");
  const fadeTimer = setTimeout(() => msgElem.classList.add("fadeout"), 1500);
  const clearTimer = setTimeout(
    () => msgElem.classList.remove("gptmark-highlight", "fadeout"),
    3000
  );
  _highlightTimers.set(msgElem, { fadeTimer, clearTimer });
}

// 滾動到特定訊息並高亮
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "scrollToMessage") return;
  const msgElem = document.querySelector(`[data-message-id="${message.id}"]`);
  if (!msgElem) {
    sendResponse?.({ result: "not-found" });
    return;
  }

  const chatContainer = document.querySelector("main div[class*='overflow-y']");
  if (chatContainer) {
    const containerRect = chatContainer.getBoundingClientRect();
    const msgRect = msgElem.getBoundingClientRect();
    const curTop = chatContainer.scrollTop;
    const alignTop = curTop + (msgRect.top - containerRect.top);
    const maxScroll = chatContainer.scrollHeight - chatContainer.clientHeight;
    const topPadding = 8;
    const targetTop = Math.max(0, Math.min(alignTop - topPadding, maxScroll));
    chatContainer.scrollTo({ top: targetTop, behavior: "smooth" });
  } else {
    msgElem.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  highlightMessage(msgElem);
  sendResponse?.({ result: "scrolled" });
});

// 回應 sidebar 查詢訊息排序順序
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getChatOrder") {
    const elems = document.querySelectorAll(
      '[data-message-author-role="user"][data-message-id], [data-message-author-role="assistant"][data-message-id]'
    );
    const order = Array.from(elems).map((el) => el.dataset.messageId);
    sendResponse({ order });
  }
});

// 滾動到最上/最下
chrome.runtime.onMessage.addListener((message) => {
  const chatContainer = document.querySelector("main div[class*='overflow-y']");
  if (!chatContainer) return;
  if (message.type === "scroll-to-top")
    chatContainer.scrollTo({ top: 0, behavior: "smooth" });
  if (message.type === "scroll-to-bottom")
    chatContainer.scrollTo({
      top: chatContainer.scrollHeight,
      behavior: "smooth",
    });
});

// ---------- 啟動流程 ----------
window.addEventListener("load", () => {
  injectExistingActions();
  observeAllTurns();
  observeMoodChange();
  setInterval(injectExistingActions, SCAN_INTERVAL);
});

// ---------- 路由變化偵測（沿用 main 名稱） ----------
(function (H) {
  ["pushState", "replaceState"].forEach((type) => {
    const orig = H[type];
    H[type] = function () {
      const ret = orig.apply(this, arguments);
      window.dispatchEvent(new Event("chatgpt-location-change"));
      return ret;
    };
  });
})(history);

let lastPath = location.pathname;
function handleLocationChange() {
  if (location.pathname === lastPath) return;
  lastPath = location.pathname;
  setTimeout(() => {
    injectExistingActions();
    refreshBookmarkIcons(); // 書籤檔案狀態（空心/實心）
    updateActionIcons(); // 主題濾鏡（兩顆按鈕同時更新）
  }, 600);
}
window.addEventListener("chatgpt-location-change", handleLocationChange);
window.addEventListener("popstate", handleLocationChange);

// 監聽當前聊天室 key 的書籤資料變化（local + sync），刷新圖示（沿用 main）
(function bindBookmarkWatcher() {
  let currentKey = getCurrentChatKey();
  if (!currentKey) return;

  onKeyStorageChanged(currentKey, () => {
    if (getCurrentChatKey() !== currentKey) return;
    if (typeof refreshBookmarkIcons === "function") refreshBookmarkIcons();
  });

  const _pushState = history.pushState;
  history.pushState = function (...args) {
    const ret = _pushState.apply(this, args);
    const nextKey = getCurrentChatKey();
    if (nextKey && nextKey !== currentKey) {
      currentKey = nextKey;
      onKeyStorageChanged(currentKey, () => {
        if (getCurrentChatKey() !== currentKey) return;
        if (typeof refreshBookmarkIcons === "function") refreshBookmarkIcons();
      });
    }
    return ret;
  };

  window.addEventListener("popstate", () => {
    const nextKey = getCurrentChatKey();
    if (nextKey && nextKey !== currentKey) {
      currentKey = nextKey;
      onKeyStorageChanged(currentKey, () => {
        if (getCurrentChatKey() !== currentKey) return;
        if (typeof refreshBookmarkIcons === "function") refreshBookmarkIcons();
      });
    }
  });
})();

// 啟動後告訴 sidebar 已準備好
chrome.runtime.sendMessage({ type: "chatgpt-ready" });
