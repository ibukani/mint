import "./core/mocks/tauriMock";
import "./index.css";
import "./design/feedback.css";
import "./design/workspaces.css";
import "./design/clock.css";
import "./design/settings.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
