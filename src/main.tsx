import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppServicesProvider } from "./composition/AppServicesContext";
import { ErrorBoundary } from "./components/ErrorBoundary/ErrorBoundary";
import { UndoProvider } from "./contexts/UndoContext";
import "./i18n";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <UndoProvider>
        <AppServicesProvider>
          <App />
        </AppServicesProvider>
      </UndoProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
