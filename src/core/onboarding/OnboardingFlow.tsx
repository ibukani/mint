import {
  Archive,
  CalendarDays,
  Clock3,
  Command,
  Gamepad2,
  Mic2,
  Monitor,
  Moon,
  NotebookPen,
  Rocket,
  Sun,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import { Button, Field, ShortcutInput, Switch } from "../../design/components";
import { TitleBar } from "../../design/layout";
import { useWindowDrag } from "../../design/layout/useWindowDrag";
import { useAppSettings } from "../context/AppSettings";
import { openOverlay } from "../windowCommands";
import { getRecommendedAction, ONBOARDING_FEATURES } from "./onboardingModel";
import {
  ONBOARDING_STEP_COUNT,
  useOnboardingController,
} from "./useOnboardingController";
import "./OnboardingFlow.css";

const featureIcons: Record<string, typeof Clock3> = {
  clock: Clock3,
  calendar: CalendarDays,
  gameLauncher: Gamepad2,
  quickCapture: NotebookPen,
  fileShelf: Archive,
  voiceToText: Mic2,
  mintPalette: Command,
};

const themeOptions = [
  {
    value: "dark",
    label: "ダーク",
    description: "目にやさしい暗色テーマ",
    icon: Moon,
  },
  {
    value: "light",
    label: "ライト",
    description: "明るく見やすいテーマ",
    icon: Sun,
  },
  {
    value: "system",
    label: "システム",
    description: "OSの外観設定に合わせる",
    icon: Monitor,
  },
] as const;

const stepTitles = [
  "使う機能を選ぶ",
  "呼び出し操作を確認",
  "外観と常駐設定",
  "最初の操作を試す",
];

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

interface OnboardingFlowProps {
  onComplete: () => void;
}

const resolveThemeMode = (mode: string): "light" | "dark" => {
  if (mode !== "system") return mode === "light" ? "light" : "dark";
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
};

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
}) => {
  const controller = useOnboardingController(onComplete);
  const windowDragHandlers = useWindowDrag();
  const { settings } = useAppSettings();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const committedThemeRef = useRef<string>("dark");
  const { draft, step } = controller;

  committedThemeRef.current = settings?.theme ?? committedThemeRef.current;

  // biome-ignore lint/correctness/useExhaustiveDependencies: step が変わるたびに見出しへフォーカスを戻す意図的な依存。
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    document.title = `mint - 初回セットアップ (${step + 1}/${ONBOARDING_STEP_COUNT})`;
  }, [step]);

  // テーマのライブプレビュー。確定前の draft を反映し、アンマウント時に
  // コミット済みテーマへ戻す（キャンセル時に元へ戻せる）。
  useEffect(() => {
    if (!draft) return undefined;
    document.documentElement.dataset.theme = resolveThemeMode(draft.theme);
    return () => {
      document.documentElement.dataset.theme = resolveThemeMode(
        committedThemeRef.current,
      );
    };
  }, [draft]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isEditableTarget(event.target)) return;
      event.preventDefault();
      controller.goBack();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [controller]);

  if (!draft) return null;

  const isLastStep = step === ONBOARDING_STEP_COUNT - 1;
  const canProceed =
    step !== 1 || Object.keys(controller.shortcutErrors).length === 0;
  const recommendedAction = getRecommendedAction(draft);
  const enabledFeatureCount = ONBOARDING_FEATURES.filter(
    (feature) => draft.featureEnabled[feature.settingsKey],
  ).length;

  const handleTryAction = () => {
    if (!recommendedAction) return;
    void openOverlay(recommendedAction.target);
  };

  return (
    <div className="onboarding-flow design-panel" {...windowDragHandlers}>
      <TitleBar
        title="mint"
        contextLabel="初回セットアップ"
        quickSwitcherShortcut=""
        quickSwitcherAriaShortcut=""
      />
      <div className="onboarding-flow__body">
        <header className="onboarding-flow__progress" aria-live="polite">
          <div className="onboarding-flow__steps">
            {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: ステップ位置は順序で一意なのでインデックスをキーに使う。
                key={index}
                className={`onboarding-flow__step-dot${index <= step ? " is-active" : ""}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <span className="onboarding-flow__progress-label">
            ステップ {step + 1} / {ONBOARDING_STEP_COUNT}
          </span>
        </header>

        <main className="onboarding-flow__content">
          <h1 className="onboarding-flow__title" tabIndex={-1} ref={headingRef}>
            {stepTitles[step]}
          </h1>

          {step === 0 && (
            <section
              className="onboarding-flow__section"
              aria-label="Mintの説明と機能の選択"
            >
              <p className="onboarding-flow__lead">
                Mintは、ショートカットで素早く呼び出せる個人向けデスクトップツール集です。
                使いたい機能を選んでください。あとから設定画面でいつでも変更できます。
              </p>
              <div className="onboarding-flow__feature-grid">
                {ONBOARDING_FEATURES.map((feature) => {
                  const Icon = featureIcons[feature.settingsKey] ?? Command;
                  const enabled = draft.featureEnabled[feature.settingsKey];
                  return (
                    <label
                      key={feature.settingsKey}
                      className={`onboarding-feature-card${enabled ? " is-enabled" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="onboarding-feature-card__input"
                        checked={enabled}
                        onChange={(event) =>
                          controller.updateFeatureEnabled(
                            feature.settingsKey,
                            event.target.checked,
                          )
                        }
                        aria-label={`${feature.label}を使う`}
                      />
                      <span
                        className="onboarding-feature-card__icon"
                        aria-hidden="true"
                      >
                        <Icon size={18} />
                      </span>
                      <span className="onboarding-feature-card__copy">
                        <strong>{feature.label}</strong>
                        <small>{feature.description}</small>
                        {feature.requiresExternalSetup && (
                          <em>後で接続が必要です</em>
                        )}
                      </span>
                      <span
                        className="onboarding-feature-card__check"
                        aria-hidden="true"
                      >
                        {enabled ? "✓" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {step === 1 && (
            <section
              className="onboarding-flow__section"
              aria-label="ショートカットの確認"
            >
              <p className="onboarding-flow__lead">
                選択した機能の呼び出しショートカットを確認します。入力欄を選択して
                使いたいキーの組み合わせを押すと変更できます。
              </p>
              <div className="onboarding-flow__shortcut-list">
                <Field
                  id="onboarding-settings-shortcut"
                  label="設定画面表示ショートカット"
                  error={controller.shortcutErrors.settings}
                >
                  <ShortcutInput
                    id="onboarding-settings-shortcut"
                    value={draft.settingsShortcut}
                    invalid={!!controller.shortcutErrors.settings}
                    onChange={controller.updateSettingsShortcut}
                  />
                </Field>
                {ONBOARDING_FEATURES.filter(
                  (feature) => draft.featureEnabled[feature.settingsKey],
                ).map((feature) => (
                  <Field
                    key={feature.settingsKey}
                    id={`onboarding-shortcut-${feature.settingsKey}`}
                    label={`${feature.label}を開く`}
                    error={controller.shortcutErrors[feature.settingsKey]}
                  >
                    <ShortcutInput
                      id={`onboarding-shortcut-${feature.settingsKey}`}
                      value={draft.shortcuts[feature.settingsKey] ?? ""}
                      invalid={!!controller.shortcutErrors[feature.settingsKey]}
                      onChange={(value) =>
                        controller.updateShortcut(feature.settingsKey, value)
                      }
                    />
                  </Field>
                ))}
              </div>
              {Object.keys(controller.shortcutErrors).length > 0 && (
                <p className="onboarding-flow__conflict" role="alert">
                  ショートカットキーが重複しています。異なるキーを設定してください。
                </p>
              )}
            </section>
          )}

          {step === 2 && (
            <section
              className="onboarding-flow__section"
              aria-label="外観と常駐設定"
            >
              <p className="onboarding-flow__lead">
                見た目と、Mintを常駐させる方法を確認します。
              </p>
              <Field label="テーマ設定">
                <div
                  className="onboarding-theme-grid"
                  role="radiogroup"
                  aria-label="テーマ設定"
                >
                  {themeOptions.map(
                    ({ value, label, description, icon: Icon }) => {
                      const isActive = draft.theme === value;
                      return (
                        <label
                          key={value}
                          className={`onboarding-theme-card${isActive ? " is-active" : ""}`}
                        >
                          <input
                            className="onboarding-theme-card__input"
                            type="radio"
                            name="onboarding-theme"
                            value={value}
                            checked={isActive}
                            aria-label={label}
                            onChange={() => controller.updateTheme(value)}
                          />
                          <span
                            className={`onboarding-theme-card__preview onboarding-theme-card__preview--${value}`}
                          >
                            <span />
                          </span>
                          <span className="onboarding-theme-card__copy">
                            <strong>
                              <Icon size={16} aria-hidden="true" />
                              {label}
                            </strong>
                            <small>{description}</small>
                          </span>
                        </label>
                      );
                    },
                  )}
                </div>
              </Field>
              <Field
                id="onboarding-autostart"
                label="PC起動時に自動で起動する"
                helpText="アプリはバックグラウンドで待機し、ショートカットでいつでも呼び出せます。"
              >
                <Switch
                  id="onboarding-autostart"
                  checked={draft.autostart}
                  onChange={(event) =>
                    controller.updateAutostart(event.target.checked)
                  }
                />
              </Field>
              <p className="onboarding-flow__note">
                ウィンドウの閉じるボタンでアプリは終了せず、タスクトレイに格納されます。
                完全に終了するには、トレイのメニューから終了を選択してください。
              </p>
            </section>
          )}

          {step === 3 && (
            <section
              className="onboarding-flow__section"
              aria-label="最初の操作"
            >
              <p className="onboarding-flow__lead">
                {enabledFeatureCount > 0
                  ? "セットアップは完了です。まずはおすすめの操作を試してみましょう。"
                  : "セットアップは完了です。設定画面からいつでも機能を有効にできます。"}
              </p>
              {recommendedAction && (
                <div className="onboarding-flow__action-card">
                  <Rocket size={20} aria-hidden="true" />
                  <div>
                    <strong>{recommendedAction.title}</strong>
                    <p>{recommendedAction.description}</p>
                  </div>
                  <Button variant="ghost" onClick={handleTryAction}>
                    試す
                  </Button>
                </div>
              )}
              <p className="onboarding-flow__note">
                試さずに完了しても、設定画面からいつでも再実行できます。
              </p>
            </section>
          )}
        </main>

        <footer className="onboarding-flow__footer">
          <Button
            variant="ghost"
            onClick={controller.skip}
            disabled={controller.isCommitting}
          >
            後で設定する
          </Button>
          <div className="onboarding-flow__footer-actions">
            {step > 0 && (
              <Button
                variant="ghost"
                onClick={controller.goBack}
                disabled={controller.isCommitting}
              >
                戻る
              </Button>
            )}
            {!isLastStep ? (
              <Button
                variant="primary"
                onClick={controller.goNext}
                disabled={!canProceed || controller.isCommitting}
              >
                次へ
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={controller.commit}
                disabled={controller.isCommitting}
              >
                {controller.isCommitting ? "保存中..." : "完了"}
              </Button>
            )}
          </div>
        </footer>

        {controller.commitError && (
          <p className="onboarding-flow__error" role="alert">
            {controller.commitError}
          </p>
        )}
      </div>
    </div>
  );
};
