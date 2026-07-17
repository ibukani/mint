import type { SettingsSearchResult } from "./settingsQuickSwitcherSearch";

interface SettingsQuickSwitcherOptionProps<TTabId extends string> {
  result: SettingsSearchResult<TTabId>;
  resultId: string;
  index: number;
  activeIndex: number;
  activeTab: TTabId;
  isRecent: boolean;
  isSelecting: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

export const SettingsQuickSwitcherOption = <TTabId extends string>({
  result,
  resultId,
  index,
  activeIndex,
  activeTab,
  isRecent,
  isSelecting,
  onClick,
  onMouseEnter,
}: SettingsQuickSwitcherOptionProps<TTabId>) => {
  const label =
    result.kind === "setting"
      ? result.item.label
      : result.kind === "action"
        ? result.action.label
        : result.tab.label;
  const description =
    result.kind === "setting"
      ? [
          result.tab.navigationLabel ?? result.tab.label,
          result.item.description,
        ]
          .filter(Boolean)
          .join(" · ")
      : result.kind === "action"
        ? result.action.disabled
          ? result.action.disabledReason
          : result.action.description
        : result.tab.description;
  const isDisabled = result.kind === "action" && result.action.disabled;
  const scope = isDisabled
    ? "無効"
    : isRecent
      ? "最近"
      : result.kind === "setting"
        ? "項目"
        : result.kind === "action"
          ? "操作"
          : null;

  return (
    <button
      type="button"
      role="option"
      id={resultId}
      tabIndex={-1}
      className={`settings-switcher__option${result.kind === "setting" ? " is-setting" : ""}${result.kind === "action" ? " is-action" : ""}${isDisabled ? " is-disabled" : ""}${isRecent ? " is-recent" : ""} ${index === activeIndex ? "is-active" : ""}`}
      aria-selected={index === activeIndex}
      aria-disabled={isDisabled ? "true" : undefined}
      title={isDisabled ? result.action.disabledReason : undefined}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      disabled={isSelecting}
    >
      <span className="settings-switcher__option-icon" aria-hidden="true">
        {result.kind === "action" ? result.action.icon : result.tab.icon}
      </span>
      <span className="settings-switcher__option-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      {result.kind === "tab" && result.tab.id === activeTab && (
        <span className="settings-switcher__current">表示中</span>
      )}
      {scope && <span className="settings-switcher__scope">{scope}</span>}
    </button>
  );
};
