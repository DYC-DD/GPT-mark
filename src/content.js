(() => {
  "use strict";

  const DOUBLE_ENTER_DELAY = 200;

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

    const input = target.closest(
      'textarea, [contenteditable="true"], [role="textbox"]'
    );
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

  function looksLikeSubmitButton(button) {
    const text = getButtonText(button);
    return /Save\s*&\s*Submit|Send message|Send|傳送|送出|儲存並提交|保存并提交/i.test(
      text
    );
  }

  function looksLikeCancelButton(button) {
    return /Cancel|取消/i.test(getButtonText(button));
  }

  function hasEditControls(scope) {
    const buttons = Array.from(scope.querySelectorAll("button"));
    return buttons.some(looksLikeSubmitButton) && buttons.some(looksLikeCancelButton);
  }

  function findEditingScope(input) {
    let scope = input;

    while (scope && scope !== document.body) {
      if (hasEditControls(scope)) return scope;
      scope = scope.parentElement;
    }

    return null;
  }

  function isEditingMode(input) {
    return (
      !!findEditingScope(input) ||
      !!document.querySelector("button.btn.relative.btn-primary")
    );
  }

  function findSendButton(input) {
    const selectors = [
      '[data-testid="send-button"]',
      "button.btn.relative.btn-primary",
      'button[aria-label="Send message"]',
      'button[aria-label="Send"]',
      'button[type="submit"]',
    ];

    const scopes = [findEditingScope(input), document].filter(Boolean);

    for (const scope of scopes) {
      for (const selector of selectors) {
        const button = scope.querySelector(selector);
        if (button) return button;
      }

      const textButton = Array.from(scope.querySelectorAll("button")).find(
        looksLikeSubmitButton
      );
      if (textButton) return textButton;
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

    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      insertNewline(input);
      resetEnterState();
      return;
    }

    if (!isEditingMode(input)) {
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

  document.addEventListener("keydown", handleKeyDown, true);
})();
