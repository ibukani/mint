export interface GameLauncherSettings {
  enabled: boolean;
  shortcut: string;
}

export type GameStore = "steam" | "epic" | "riot";

export interface InstalledGame {
  id: string;
  title: string;
  store: GameStore;
  imagePath: string | null;
}

export interface GameSourceStatus {
  store: GameStore;
  detected: boolean;
  warning: string | null;
}

export interface GameScanResult {
  games: InstalledGame[];
  sources: GameSourceStatus[];
}

export interface LaunchGameRequest {
  id: string;
  store: GameStore;
}
