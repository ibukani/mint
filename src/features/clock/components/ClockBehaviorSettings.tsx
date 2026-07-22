import { Minus, Plus, TimerReset } from "lucide-react";
import type React from "react";
import {
  Button,
  Field,
  FieldRow,
  ShortcutInput,
  TextInput,
  UnitLabel,
} from "../../../design/components";
import type { ClockSettingsController } from "../hooks/useClockSettingsController";
import {
  CLOCK_AUTO_HIDE_MAX_SECONDS,
  CLOCK_AUTO_HIDE_MIN_SECONDS,
  normalizeAutoHideSeconds,
} from "../settings";

export const ClockBehaviorSettings: React.FC<{
  controller: ClockSettingsController;
}> = ({ controller }) => {
  const { clock, handleChange, shortcutError, changeAutoHideSeconds } =
    controller;

  return (
    <section className="settings-group" aria-labelledby="clock-behavior-title">
      <div className="settings-group__heading">
        <TimerReset size={17} aria-hidden="true" />
        <div>
          <h3 id="clock-behavior-title">呼び出し</h3>
          <p>表示するキーと閉じるタイミング</p>
        </div>
      </div>
      <Field
        id="clock-shortcut-input"
        label="起動ショートカットキー"
        error={shortcutError}
        helpText="入力欄を選択して、使いたいキーの組み合わせを押します。"
      >
        <ShortcutInput
          id="clock-shortcut-input"
          invalid={Boolean(shortcutError)}
          value={clock.shortcut}
          onChange={(value) => handleChange("shortcut", value)}
          placeholderText="例: Alt+Left"
        />
      </Field>
      <Field
        id="clock-hide-seconds-input"
        label="表示秒数 (0でトグル表示)"
        helpText="0秒では、もう一度ショートカットを押すまで表示します。"
      >
        <FieldRow>
          <Button
            variant="ghost"
            className="clock-step-button"
            onClick={() => changeAutoHideSeconds(-1)}
            disabled={clock.autoHideSeconds <= CLOCK_AUTO_HIDE_MIN_SECONDS}
            aria-label="表示秒数を1秒減らす"
          >
            <Minus size={16} aria-hidden="true" />
          </Button>
          <TextInput
            id="clock-hide-seconds-input"
            type="number"
            min={String(CLOCK_AUTO_HIDE_MIN_SECONDS)}
            max={String(CLOCK_AUTO_HIDE_MAX_SECONDS)}
            controlSize="number"
            value={clock.autoHideSeconds}
            onChange={(event) =>
              handleChange(
                "autoHideSeconds",
                normalizeAutoHideSeconds(event.target.value),
              )
            }
          />
          <UnitLabel>秒</UnitLabel>
          <Button
            variant="ghost"
            className="clock-step-button"
            onClick={() => changeAutoHideSeconds(1)}
            disabled={clock.autoHideSeconds >= CLOCK_AUTO_HIDE_MAX_SECONDS}
            aria-label="表示秒数を1秒増やす"
          >
            <Plus size={16} aria-hidden="true" />
          </Button>
        </FieldRow>
      </Field>
    </section>
  );
};
