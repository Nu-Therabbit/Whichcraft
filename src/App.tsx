import { useEffect, useMemo } from "react";
import { createToolsRuntime } from "./composition/appServices";
import { useAppServices } from "./composition/AppServicesContext";
import { EnvironmentProvider } from "./features/environment/EnvironmentContext";
import { LegacyEnvironmentView } from "./features/environment/LegacyEnvironmentView";
import { useToolsStore } from "./features/tools/useToolsStore";

function LegacyAppRoot() {
  const services = useAppServices();
  const toolsRuntime = useMemo(() => createToolsRuntime(services), [services]);
  const { state: tools, dispatch: sendTools } = useToolsStore("java", toolsRuntime);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the legacy app starts
  useEffect(() => sendTools({ type: "started" }), []);

  return (
    <EnvironmentProvider>
      <LegacyEnvironmentView tools={tools} sendTools={sendTools} />
    </EnvironmentProvider>
  );
}

export default function App() {
  return <LegacyAppRoot />;
}
