import { EnvironmentProvider } from "./features/environment/EnvironmentContext";
import { LegacyEnvironmentView } from "./features/environment/LegacyEnvironmentView";
import { DesktopShellApp } from "./features/shell/DesktopShellApp";
import { ToolsProvider, useTools } from "./features/tools/ToolsContext";
import type { AppPresentation } from "./lib/appPresentation";

function LegacyToolsView() {
  const { state, dispatch } = useTools();
  return <LegacyEnvironmentView tools={state} sendTools={dispatch} />;
}

function LegacyAppRoot() {
  return (
    <ToolsProvider>
      <EnvironmentProvider>
        <LegacyToolsView />
      </EnvironmentProvider>
    </ToolsProvider>
  );
}

export default function App({ presentation }: { presentation: AppPresentation }) {
  if (presentation === "desktop-shell") {
    return <DesktopShellApp />;
  }
  return <LegacyAppRoot />;
}
