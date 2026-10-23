import { useEffect, useMemo } from "react";
import { createToolsRuntime } from "./composition/appServices";
import { useAppServices } from "./composition/AppServicesContext";
import { useWriteCoordinator } from "./coordination/WriteCoordinatorContext";
import { EnvironmentProvider } from "./features/environment/EnvironmentContext";
import { LegacyEnvironmentView } from "./features/environment/LegacyEnvironmentView";
import { DesktopShellApp } from "./features/shell/DesktopShellApp";
import { scopesNeedToolsRefresh } from "./features/shell/useShellToolsWrite";
import { useToolsStore } from "./features/tools/useToolsStore";
import { readAppPresentation } from "./lib/appPresentation";

function LegacyAppRoot() {
  const services = useAppServices();
  const coordination = useWriteCoordinator();
  const toolsRuntime = useMemo(() => createToolsRuntime(services, coordination), [services, coordination]);
  const { state: tools, dispatch: sendTools } = useToolsStore("java", toolsRuntime);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the legacy app starts
  useEffect(() => sendTools({ type: "started" }), []);

  useEffect(() => {
    return coordination.subscribeInvalidation((scopes) => {
      if (!scopesNeedToolsRefresh(scopes)) return;
      sendTools({ type: "refresh" });
      sendTools({ type: "loadProfiles" });
      if (scopes.includes("tools-shell-check") && tools.shellCheck) {
        sendTools({ type: "checkShell" });
      }
    });
  }, [coordination, sendTools, tools.shellCheck]);

  return (
    <EnvironmentProvider>
      <LegacyEnvironmentView tools={tools} sendTools={sendTools} />
    </EnvironmentProvider>
  );
}

export default function App() {
  const presentation = readAppPresentation();
  if (presentation === "desktop-shell") {
    return <DesktopShellApp />;
  }
  return <LegacyAppRoot />;
}
