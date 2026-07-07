import React, { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppSettingsProvider, useAppSettings } from "./core/context/AppSettings";
import { ErrorToast } from "./core/components/ErrorToast";
import { WINDOW_ROUTES } from "./core/windowRoutes";
import { ClockSettings } from "./features/clock/components/ClockSettings";
import { VoiceToTextSettings } from "./features/v2t/components/VoiceToTextSettings";

const TAB_CONFIG = [
  { id: "general", label: "一般設定" },
  { id: "clock", label: "時計オーバーレイ" },
  { id: "v2t", label: "音声入力" },
] as const;

type TabId = (typeof TAB_CONFIG)[number]["id"];

const GeneralSettings: React.FC = () => {
  const { settings, updateSettings } = useAppSettings();

  if (!settings) return null;

  return (
    <div className="settings-section">
      <h2 className="section-title">一般設定</h2>
      <p className="section-description">
        アプリケーション全体の基本的な挙動を設定します。
      </p>

      <div className="form-group">
        <label className="form-label">テーマ設定</label>
        <select
          className="form-control"
          value={settings.theme}
          onChange={(e) => updateSettings({ theme: e.target.value as "dark" | "light" })}
        >
          <option value="dark">ダークモード (Dark)</option>
          <option value="light">ライトモード (Light)</option>
        </select>
      </div>
    </div>
  );
};

const TAB_COMPONENTS: Record<TabId, React.FC> = {
  general: GeneralSettings,
  clock: ClockSettings,
  v2t: VoiceToTextSettings,
};

const AppContent: React.FC = () => {
  const { loading, error, clearError } = useAppSettings();
  const [label, setLabel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("general");

  useEffect(() => {
    setLabel(getCurrentWindow().label);
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        設定を読み込み中...
      </div>
    );
  }

  // Overlay window routing via lookup table
  if (label && label in WINDOW_ROUTES) {
    const OverlayComponent = WINDOW_ROUTES[label];
    return <OverlayComponent />;
  }

  // Main settings window
  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

  return (
    <>
      <ErrorToast message={error} onDismiss={clearError} />
      <div className="glass-panel main-container">
        <div className="sidebar">
          <h1 className="app-title">mint</h1>
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              className={`nav-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="content">
          <ActiveTabComponent />
        </div>
      </div>
    </>
  );
};

function App() {
  return (
    <AppSettingsProvider>
      <AppContent />
    </AppSettingsProvider>
  );
}

export default App;
