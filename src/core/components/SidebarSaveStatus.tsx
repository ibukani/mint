import type React from "react";
import {
  SidebarStatusFooter,
  type SidebarStatusTone,
} from "../../design/layout/Sidebar";
import { useSettingsSaveStatus } from "../context/AppSettings";
import type { SaveStatus } from "../settingsModel";

const saveSidebarLabels: Record<SaveStatus, string> = {
  idle: "変更時に自動保存",
  pending: "変更を保存待ち",
  saving: "保存中",
  saved: "最新の状態です",
  error: "再試行が必要です",
};

const saveSidebarTones: Record<SaveStatus, SidebarStatusTone> = {
  idle: "neutral",
  pending: "pending",
  saving: "pending",
  saved: "success",
  error: "error",
};

/**
 * Self-subscribing save-status footer for the settings sidebar. Subscribes to
 * the save-status slice only, so save-status transitions re-render just this
 * leaf instead of the whole settings tree.
 */
export const SidebarSaveStatus: React.FC = () => {
  const saveStatus = useSettingsSaveStatus();
  return (
    <SidebarStatusFooter
      label={saveSidebarLabels[saveStatus]}
      tone={saveSidebarTones[saveStatus]}
    />
  );
};
