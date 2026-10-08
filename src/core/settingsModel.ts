import type { CalendarSettings } from "../features/calendar/types";
import type { ClockSettings } from "../features/clock/types";
import type { GameLauncherSettings } from "../features/game_launcher/types";
import type { MintPaletteSettings } from "../features/mint_palette/types";

export type ThemeMode = "dark" | "light" | "system";

export interface OnboardingSettings {
  completedVersion: number;
  completedAt?: string;
}

export interface AppSettings {
  mintPalette: MintPaletteSettings;
  gameLauncher: GameLauncherSettings;
  calendar: CalendarSettings;
  autostart: boolean;
  theme: ThemeMode;
  settingsShortcut: string;
  clock: ClockSettings;
  onboarding: OnboardingSettings;
}

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export type SettingsUpdate =
  | Partial<AppSettings>
  | ((previous: AppSettings) => AppSettings);

export type FeatureSettingsKey = Exclude<
  keyof AppSettings,
  "theme" | "settingsShortcut" | "autostart" | "onboarding"
>;
