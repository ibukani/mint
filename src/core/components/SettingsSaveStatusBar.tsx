import type React from "react";
import {
  useRetrySaveSettings,
  useSettingsSaveStatus,
} from "../context/AppSettings";
import { SettingsSaveStatus } from "./SettingsSaveStatus";

/**
 * Self-subscribing save-status indicator for the settings content area.
 * Subscribes to the save-status slice only, so save-status transitions
 * re-render just this leaf instead of the whole settings tree.
 */
export const SettingsSaveStatusBar: React.FC = () => {
  const status = useSettingsSaveStatus();
  const retrySaveSettings = useRetrySaveSettings();
  return <SettingsSaveStatus status={status} onRetry={retrySaveSettings} />;
};
