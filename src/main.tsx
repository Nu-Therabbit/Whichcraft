import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { freezeAppPresentation } from "./lib/appPresentation";
import { AppServicesProvider } from "./composition/AppServicesContext";
import { WriteCoordinatorProvider } from "./coordination/WriteCoordinatorContext";
import { ErrorBoundary } from "./components/ErrorBoundary/ErrorBoundary";
import { UndoProvider } from "./contexts/UndoContext";
import { applyThemeToDocument, getInitialTheme } from "./lib/themeDocument";
import "./i18n";
import "./index.css";

applyThemeToDocument(getInitialTheme());

const appPresentation = freezeAppPresentation(
  window.location.search,
  window.__WHICHCRAFT_PRESENTATION__,
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <UndoProvider>
        <AppServicesProvider>
          <WriteCoordinatorProvider>
            <App presentation={appPresentation} />
          </WriteCoordinatorProvider>
        </AppServicesProvider>
      </UndoProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
