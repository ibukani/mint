import type { CalendarSettings } from "../features/calendar/types";
import type { ClockSettings } from "../features/clock/types";
import type { GameLauncherSettings } from "../features/game_launcher/types";
import type { VoiceToTextSettings } from "../features/v2t/types";

export interface AppSettings {
  gameLauncher: GameLauncherSettings;
  calendar: CalendarSettings;
  autostart: boolean;
  theme: "dark" | "light";
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
