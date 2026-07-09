export interface ClockSettings {
  enabled: boolean;
  shortcut: string;
  autoHideSeconds: number;
  fontSize: string;
  showDate: boolean;
  showSeconds: boolean;
  clockColor: string;
  blinkColon: boolean;
  sizePercent: number;
  displayMode: "digital" | "analog";
  hourFormat: "12h" | "24h";
  glowEffect: boolean;
}
