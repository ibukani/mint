export interface ClockSettings {
  enabled: boolean;
  shortcut: string;
  autoHideSeconds: number;
  showDate: boolean;
  showSeconds: boolean;
  themeColor: string;
  blinkColon: boolean;
  sizePercent: number;
  displayMode: "digital" | "analog";
  hourFormat: "12h" | "24h";
  glowEffect: boolean;
}
