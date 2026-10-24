import type { WhichcraftSettings } from "../../platform/types";
import type { ToolsDispatch } from "../tools/useToolsStore";

export function installStoreGate(settings: WhichcraftSettings | null, dispatch: ToolsDispatch) {
  return {
    confirmed: settings?.installStoreConfirmed ?? false,
    installStore: settings?.installStore ?? "",
    onConfirm: (installStore: string) => {
      if (settings) dispatch({ type: "saveSettings", settings: { ...settings, installStore, installStoreConfirmed: true } });
    },
  };
}
