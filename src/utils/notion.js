/**
 * util: Notion API helpers for GPT‑mark
 * ------------------------------------
 * Handles:
 *   1. Retrieve stored integration token from chrome.storage
 *   2. Convert simple Markdown (h1/h2/h3, code, math, paragraph) to Notion blocks
 *   3. Append blocks to a target Notion page
 *
 * Note: This file is intended to be imported from content or background scripts.
 *       Because Notion API (https://api.notion.com) has CORS restrictions, calls
 *       should be executed from the service‑worker (background) when possible.
 *       If you call from a content script you may need to use `chrome.runtime.sendMessage`
 *       to delegate network requests to the background.
 */

/* global chrome */

const NOTION_TOKEN_KEY = "notion-integration-token";
const NOTION_VERSION = "2022-06-28"; // stable API version

/**
 * Read integration token from chrome.storage.local
 * @returns {Promise<string|null>}
 */
export async function getIntegrationToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get([NOTION_TOKEN_KEY], (res) => {
      resolve(res[NOTION_TOKEN_KEY] ?? null);
    });
  });
}

/**
 * Append blocks to the given Notion page (child list of blocks)
 * @param {string} pageId – Notion page (block) ID, 32‑char UUID without dashes
 * @param {Array<Object>} blocks – Notion block objects
 * @returns {Promise<Object>} – Notion API response JSON
 */
export async function appendBlocks(pageId, blocks) {
  const token = await getIntegrationToken();
  if (!token) throw new Error("[Notion] integration token not found.");

  const url = `https://api.notion.com/v1/blocks/${pageId}/children`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({ children: blocks }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`[Notion] ${res.status} ${res.statusText}: ${detail}`);
  }
  return res.json();
}

/**
 * Convert lightweight Markdown lines into Notion blocks.
 * Supported:
 *   # / ## / ### headings  (→ heading_1 / heading_2 / heading_3)
 *   ``` (fenced) code blocks (language autodetect disabled → plain_text)
 *   $$inline$$  math blocks (full‑line $$...$$)
 *   normal lines → paragraph blocks
 * @param {string} md – raw markdown
 * @returns {Array<Object>} Notion blocks
 */
export function markdownToBlocks(md) {
  const lines = md.split(/\r?\n/);
  const blocks = [];
  let inCode = false;
  let codeBuf = [];
  let dividerUsed = false;

  const flushCode = () => {
    if (!codeBuf.length) return;
    blocks.push({
      object: "block",
      type: "code",
      code: {
        language: "plain text",
        rich_text: [{ type: "text", text: { content: codeBuf.join("\n") } }],
      },
    });
    codeBuf = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    // only first '---' as divider
    if (!inCode && trimmed === "---" && !dividerUsed) {
      flushCode();
      blocks.push({ object: "block", type: "divider", divider: {} });
      dividerUsed = true;
      continue;
    }
    // toggle code fence ```
    if (line.trim().startsWith("```")) {
      if (inCode) flushCode();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    // math
    if (/^\$\$.*\$\$$/.test(line.trim())) {
      blocks.push({
        object: "block",
        type: "equation",
        equation: { expression: line.trim().slice(2, -2) },
      });
      continue;
    }
    // hyperlink block for URL-only lines
    if (/^https?:\/\/\S+$/.test(trimmed)) {
      flushCode();
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: trimmed, link: { url: trimmed } },
            },
          ],
        },
      });
      continue;
    }

    // headings
    if (/^###\s+/.test(line)) {
      blocks.push(makeHeading(line.replace(/^###\s+/, ""), 3));
      continue;
    }
    if (/^##\s+/.test(line)) {
      blocks.push(makeHeading(line.replace(/^##\s+/, ""), 2));
      continue;
    }
    if (/^#\s+/.test(line)) {
      blocks.push(makeHeading(line.replace(/^#\s+/, ""), 1));
      continue;
    }

    // paragraph (empty lines ignored)
    if (line.trim().length) {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: line } }],
        },
      });
    }
  }
  return blocks;
}

function makeHeading(text, level = 1) {
  const key = ["heading_1", "heading_2", "heading_3"][level - 1] ?? "heading_3";
  return {
    object: "block",
    type: key,
    [key]: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

/**
 * High‑level helper: convert markdown to blocks and append to Notion.
 * @param {Object} opts
 * @param {string} opts.markdown – raw markdown text
 * @param {string} opts.pageId – destination Notion page ID (32‑char uuid without dashes)
 * @returns {Promise<Object>}
 */
export async function saveMarkdownToNotion({ markdown, pageId }) {
  const blocks = markdownToBlocks(markdown);
  return appendBlocks(pageId, blocks);
}
