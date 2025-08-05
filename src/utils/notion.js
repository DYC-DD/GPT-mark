const NOTION_TOKEN_KEY = "notion-integration-token";
const NOTION_VERSION = "2022-06-28"; // Notion API version

// ----- 讀取儲存在 storage 裡的 Notion Integration Token -----
export async function getIntegrationToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get([NOTION_TOKEN_KEY], (res) => {
      resolve(res[NOTION_TOKEN_KEY] ?? null);
    });
  });
}

// ----- 呼叫 Notion API 將 blocks 附加至指定頁面 -----
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

// ----- Markdown 轉換為 Notion blocks 陣列 -----
export function markdownToBlocks(md) {
  const lines = md.split(/\r?\n/);
  const blocks = [];
  let inCode = false;
  let codeBuf = [];
  let dividerUsed = false;

  // 匯出並清空 code 區段
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

    // 分隔線：僅允許第一個 ---
    if (!inCode && trimmed === "---" && !dividerUsed) {
      flushCode();
      blocks.push({ object: "block", type: "divider", divider: {} });
      dividerUsed = true;
      continue;
    }

    // 進入/離開 code 區塊（```）
    if (line.trim().startsWith("```")) {
      if (inCode) flushCode();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    // 數學公式（整行包在 $$...$$ 中）
    if (/^\$\$.*\$\$$/.test(line.trim())) {
      blocks.push({
        object: "block",
        type: "equation",
        equation: { expression: line.trim().slice(2, -2) },
      });
      continue;
    }

    // 純 URL 超連結段落
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

    // 標題處理
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

    // 一般段落（忽略空行）
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

// ----- 建立標題 block（heading_1/2/3） -----
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

// ----- 封裝：將 markdown 全部轉為 blocks 並寫入 Notion 頁面 -----
export async function saveMarkdownToNotion({ markdown, pageId }) {
  const blocks = markdownToBlocks(markdown);
  return appendBlocks(pageId, blocks);
}
