import type React from "react";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";

export const ClockSettings: React.FC = () => {
  const {
    featureSettings: clock,
    handleChange,
    shortcutError,
  } = useFeatureSettings("clock");

  if (!clock) return null;

  return (
    <div className="settings-section">
      <h2 className="section-title">時計オーバーレイ設定</h2>
      <p className="section-description">
        ショートカットキーを押した際に画面右上に表示される時計のカスタマイズを行います。
      </p>

      <div className="form-group">
        <label className="form-label" htmlFor="clock-shortcut-input">
          起動ショートカットキー
        </label>
        <input
          id="clock-shortcut-input"
          type="text"
          className={`form-control ${shortcutError ? "is-invalid" : ""}`}
          value={clock.shortcut}
          onChange={(e) => handleChange("shortcut", e.target.value)}
          placeholder="例: Ctrl+Alt+C"
        />
        {shortcutError && (
          <p
            className="error-message"
            style={{
              color: "var(--color-error, #ff4d4f)",
              marginTop: "4px",
              fontSize: "0.85rem",
              fontWeight: "bold",
            }}
          >
            {shortcutError}
          </p>
        )}
        <span className="form-help">
          Tauriのグローバルショートカットキー形式（例:
          CommandOrControl+Shift+C）で指定します。
        </span>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="clock-hide-seconds-input">
          表示秒数 (0でトグル表示)
        </label>
        <div className="range-container">
          <input
            id="clock-hide-seconds-input"
            type="number"
            min="0"
            max="60"
            className="form-control number-input"
            value={clock.autoHideSeconds}
            onChange={(e) =>
              handleChange("autoHideSeconds", parseInt(e.target.value, 10) || 0)
            }
          />
          <span className="unit-label">秒</span>
        </div>
        <span className="form-help">
          時計が表示されてから自動で消えるまでの秒数です。0に設定すると再度ショートカットを押すまで常時表示されます。
        </span>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="clock-font-size-select">
          フォントサイズ
        </label>
        <select
          id="clock-font-size-select"
          className="form-control"
          value={clock.fontSize}
          onChange={(e) => handleChange("fontSize", e.target.value)}
        >
          <option value="1.2rem">小 (1.2rem)</option>
          <option value="1.5rem">中 (1.5rem)</option>
          <option value="2rem">大 (2rem)</option>
          <option value="2.5rem">特大 (2.5rem)</option>
        </select>
      </div>
    </div>
  );
};
