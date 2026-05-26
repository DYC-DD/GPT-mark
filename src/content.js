(() => {
  "use strict";

  const DOUBLE_ENTER_DELAY = 200;
  const MAX_EDIT_SCOPE_DEPTH = 8;
  const CHAT_INPUT_SELECTOR =
    'textarea, [contenteditable="true"], [role="textbox"]';
  const PROMPT_COMPOSER_SELECTOR =
    '#prompt-textarea, [data-testid="prompt-textarea"], [name="prompt-textarea"], form[data-type="unified-composer"], [data-testid="composer-root"]';
  const EDIT_SCOPE_BOUNDARY_SELECTOR =
    'main, [role="main"], article, [data-testid="composer-root"]';

  let enterPressCount = 0;
  let enterPressTimer = null;

  function resetEnterState() {
    enterPressCount = 0;
    if (enterPressTimer) {
      clearTimeout(enterPressTimer);
      enterPressTimer = null;
    }
  }

  function getChatInput(target) {
    if (!(target instanceof Element)) return null;

    const input = target.closest(CHAT_INPUT_SELECTOR);
    if (!input) return null;

    if (input.tagName === "TEXTAREA") return input;
    if (input.getAttribute("contenteditable") === "true") return input;
    if (input.getAttribute("role") === "textbox") return input;

    return null;
  }

  function getButtonText(button) {
    return [
      button.textContent,
      button.getAttribute("aria-label"),
      button.getAttribute("title"),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isPromptComposer(input) {
    return (
      input instanceof Element &&
      (input.matches(PROMPT_COMPOSER_SELECTOR) ||
        !!input.closest(PROMPT_COMPOSER_SELECTOR))
    );
  }

  function looksLikeEditedSubmitButton(button) {
    const text = getButtonText(button);
    if (/Send message/i.test(text)) return false;

    return /Save\s*&\s*Submit|Save and submit|Submit|Save|Send|傳送|送出|儲存並提交|保存并提交|儲存|保存|提交/i.test(
      text
    );
  }

  function looksLikeCancelButton(button) {
    return /Cancel|取消/i.test(getButtonText(button));
  }

  function hasEditControls(scope) {
    const buttons = Array.from(scope.querySelectorAll("button"));
    return (
      buttons.some(looksLikeEditedSubmitButton) &&
      buttons.some(looksLikeCancelButton)
    );
  }

  function findEditingScope(input) {
    if (isPromptComposer(input)) return null;

    let scope = input;
    let depth = 0;

    while (scope && scope !== document.body && depth <= MAX_EDIT_SCOPE_DEPTH) {
      if (hasEditControls(scope)) return scope;
      if (scope.matches(EDIT_SCOPE_BOUNDARY_SELECTOR)) break;
      scope = scope.parentElement;
      depth += 1;
    }

    return null;
  }

  function isEditingMode(input) {
    return !!findEditingScope(input);
  }

  function findSendButton(input) {
    const selectors = [
      '[data-testid="save-button"]',
      "button.btn.relative.btn-primary",
      'button[type="submit"]',
    ];

    const scope = findEditingScope(input);
    if (!scope) return null;

    const textButton = Array.from(scope.querySelectorAll("button")).find(
      looksLikeEditedSubmitButton
    );
    if (textButton) return textButton;

    for (const selector of selectors) {
      const button = scope.querySelector(selector);
      if (button) return button;
    }

    return null;
  }

  function insertNewline(input) {
    if (input instanceof HTMLTextAreaElement) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const text = input.value || "";

      input.value = `${text.slice(0, start)}\n${text.slice(end)}`;
      input.selectionStart = input.selectionEnd = start + 1;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    if (input instanceof HTMLElement && input.isContentEditable) {
      input.focus();
      document.execCommand("insertLineBreak");
      input.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertLineBreak",
        })
      );
    }
  }

  function submitEditedMessage(input) {
    const sendButton = findSendButton(input);
    if (!sendButton) {
      console.warn("[Double Enter Send] Submit button was not found.");
      return;
    }

    const isDisabled =
      sendButton.disabled || sendButton.getAttribute("aria-disabled") === "true";
    if (isDisabled) return;

    sendButton.click();
  }

  function handleKeyDown(event) {
    const input = getChatInput(event.target);

    if (!input) {
      resetEnterState();
      return;
    }

    if (!isEditingMode(input)) {
      resetEnterState();
      return;
    }

    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      insertNewline(input);
      resetEnterState();
      return;
    }

    if (event.key !== "Enter" || event.isComposing) return;

    event.preventDefault();
    enterPressCount += 1;

    if (enterPressCount === 1) {
      enterPressTimer = setTimeout(() => {
        if (enterPressCount === 1) insertNewline(input);
        resetEnterState();
      }, DOUBLE_ENTER_DELAY);
      return;
    }

    if (enterPressCount === 2) {
      resetEnterState();
      submitEditedMessage(input);
    }
  }

  function describeElement(element) {
    if (!(element instanceof Element)) return null;

    const attrs = ["id", "class", "role", "aria-label", "data-testid", "name"]
      .map((name) => {
        const value = element.getAttribute(name);
        return value ? `${name}="${value}"` : null;
      })
      .filter(Boolean)
      .join(" ");

    return `<${element.tagName.toLowerCase()}${attrs ? ` ${attrs}` : ""}>`;
  }

  window.__doubleEnterSendDebug = function doubleEnterSendDebug() {
    const target = document.activeElement;
    const input = getChatInput(target);
    const editingScope = input ? findEditingScope(input) : null;
    const buttons = editingScope
      ? Array.from(editingScope.querySelectorAll("button"))
          .map(getButtonText)
          .filter(Boolean)
      : [];

    return {
      target: describeElement(target),
      input: describeElement(input),
      isPromptComposer: input ? isPromptComposer(input) : false,
      editingScope: describeElement(editingScope),
      buttons,
    };
  };

  document.addEventListener("keydown", handleKeyDown, true);
})();
