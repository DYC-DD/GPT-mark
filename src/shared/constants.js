(() => {
  "use strict";

  const CHATGPT_ORIGINS = Object.freeze([
    "https://chat.openai.com",
    "https://chatgpt.com",
  ]);

  const PATHS = Object.freeze({
    POPUP_PAGE: "src/popup/popup.html",
    SIDEBAR_PAGE: "src/sidebar/sidebar.html",
  });

  const STORAGE_KEYS = Object.freeze({
    SIDEBAR_LANGUAGE: "sidebar-language",
    SIDEBAR_MOOD: "sidebar-mood",
    SIDEBAR_SORT_ORDER: "sidebar-sort-order",
  });

  const LOCALES = Object.freeze({
    zh: "zh_TW",
    en: "en",
    ja: "ja",
  });

  const MESSAGE_TYPES = Object.freeze({
    CHATGPT_READY: "chatgpt-ready",
    CHATGPT_ROUTE_CHANGED: "chatgpt-route-changed",
    CHATGPT_THEME_CHANGED: "chatgpt-theme-changed",
    CLEAR_ACTION_POPUP_FOR_ACTIVE_TAB: "CLEAR_ACTION_POPUP_FOR_ACTIVE_TAB",
    GET_CHAT_ORDER: "getChatOrder",
    GET_CHAT_THEME_COLORS: "getChatThemeColors",
    REFRESH_BOOKMARK_ICONS: "refresh-bookmark-icons",
    SCROLL_TO_MESSAGE: "scrollToMessage",
  });

  const ICONS = Object.freeze({
    BOOKMARK_EMPTY: "assets/icons/bookmarks.svg",
    BOOKMARK_FILLED: "assets/icons/bookmarks-fill.svg",
    HASHTAG: "assets/icons/hashtag.svg",
    TRASH: "assets/icons/trash.svg",
  });

  function normalizeChatPath(pathname = "") {
    const path = (pathname || "").replace(/\/$/, "");
    const groupedChat = path.match(/^\/g\/[^/]+\/c\/([^/]+)$/);
    if (groupedChat) return `/c/${groupedChat[1]}`;
    return path;
  }

  function getChatKeyFromPathname(pathname = "") {
    const path = normalizeChatPath(pathname);
    if (!path || path === "/c" || /^\/g\/[^/]+\/c\/?$/.test(pathname)) {
      return null;
    }
    return path;
  }

  function isAllowedChatOrigin(url = "") {
    try {
      return CHATGPT_ORIGINS.includes(new URL(url).origin);
    } catch {
      return false;
    }
  }

  self.GPT_MARK = {
    ...(self.GPT_MARK || {}),
    CHATGPT_MATCH_PATTERNS: Object.freeze(
      CHATGPT_ORIGINS.map((origin) => `${origin}/*`)
    ),
    CHATGPT_ORIGINS,
    ICONS,
    LOCALES,
    MESSAGE_TYPES,
    PATHS,
    STORAGE_KEYS,
    getChatKeyFromPathname,
    isAllowedChatOrigin,
    normalizeChatPath,
  };
})();
