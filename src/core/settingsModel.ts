import type { CalendarSettings } from "../features/calendar/types";
import type { ClockSettings } from "../features/clock/types";
import type { FileShelfSettings } from "../features/file_shelf/types";
import type { GameLauncherSettings } from "../features/game_launcher/types";
import type { QuickCaptureSettings } from "../features/quick_capture/types";
import type { VoiceToTextSettings } from "../features/v2t/types";

export type ThemeMode = "dark" | "light" | "system";

export interface AppSettings {
  fileShelf: FileShelfSettings;
  quickCapture: QuickCaptureSettings;
  gameLauncher: GameLauncherSettings;
  calendar: CalendarSettings;
  autostart: boolean;
  theme: ThemeMode;
  settingsShortcut: string;
  clock: ClockSettings;
  voiceToText: VoiceToTextSettings;
}

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export type SettingsUpdate =
  | Partial<AppSettings>
  | ((previous: AppSettings) => AppSettings);

export type FeatureSettingsKey = Exclude<
  keyof AppSettings,
  "theme" | "settingsShortcut" | "autostart"
>;
