import type React from "react";
import { useState } from "react";

interface ShortcutInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  invalid?: boolean;
  placeholderText?: string;
}

export const ShortcutInput: React.FC<ShortcutInputProps> = ({
  value,
  onChange,
  id,
  invalid = false,
  placeholderText = "キーを押して設定...",
}) => {
  const [isRecording, setIsRecording] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Escape to cancel recording and blur
    if (e.key === "Escape") {
      setIsRecording(false);
      e.currentTarget.blur();
      return;
    }

    // Backspace or Delete without modifiers clears the shortcut
    if (
      (e.key === "Backspace" || e.key === "Delete") &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.shiftKey &&
      !e.metaKey
    ) {
      onChange("");
      setIsRecording(false);
      e.currentTarget.blur();
      return;
    }

    // Ignore if only a modifier key is pressed
    if (["Control", "Alt", "Shift", "Meta", "CapsLock"].includes(e.key)) {
      return;
    }

    const modifiers: string[] = [];
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

    if (isMac) {
      if (e.metaKey) {
        modifiers.push("CommandOrControl");
      }
      if (e.ctrlKey) {
        modifiers.push("Ctrl");
      }
    } else {
      if (e.ctrlKey) {
        modifiers.push("Ctrl");
      }
      if (e.metaKey) {
        modifiers.push("Super");
      }
    }

    if (e.altKey) {
      modifiers.push("Alt");
    }
    if (e.shiftKey) {
      modifiers.push("Shift");
    }

    // A modifier key is required to avoid hijacking normal typing keys globally
    if (modifiers.length === 0) {
      return;
    }

    let keyName = e.key;
    if (keyName === " ") {
      keyName = "Space";
    } else if (keyName.length === 1) {
      keyName = keyName.toUpperCase();
    } else {
      // Normalize Arrow keys
      if (keyName.startsWith("Arrow")) {
        keyName = keyName.replace("Arrow", "");
      }
    }

    const shortcutString = [...modifiers, keyName].join("+");
    onChange(shortcutString);
    setIsRecording(false);
    e.currentTarget.blur();
  };

  const handleFocus = () => {
    setIsRecording(true);
  };

  const handleBlur = () => {
    setIsRecording(false);
  };

  const displayValue = value || "なし";
  const shortcutParts = value ? value.split("+") : [];

  const classes = [
    "design-control",
    "design-control--shortcut",
    invalid ? "is-invalid" : "",
    isRecording ? "is-recording" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="shortcut-input-wrapper">
      <span
        className={`shortcut-input-display ${isRecording ? "shortcut-input-display--recording" : ""}`}
        aria-hidden="true"
      >
        {isRecording ? (
          <span className="shortcut-input-recording-label">
            キーの組み合わせを入力
          </span>
        ) : shortcutParts.length > 0 ? (
          shortcutParts.map((part) => (
            <kbd className="shortcut-input-key" key={part}>
              {part === "CommandOrControl" ? "⌘ / Ctrl" : part}
            </kbd>
          ))
        ) : (
          <span className="shortcut-input-empty">なし</span>
        )}
      </span>
      <input
        type="text"
        id={id}
        className={classes}
        value={displayValue}
        readOnly
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholderText}
        aria-invalid={invalid}
      />
      {isRecording && (
        <span className="shortcut-input-help">
          Escでキャンセル、Del/BSでクリア
        </span>
      )}
    </div>
  );
};
