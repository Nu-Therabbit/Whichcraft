import { useEffect } from "react";
import { InstallSection } from "../../components/ToolsPanel/InstallSection";
import { useI18n } from "../../hooks/useI18n";
import type { ToolKind } from "../tools/types";
import { TOOL_DISPLAY } from "./overviewTools";
import { useShellTools } from "./ShellToolsContext";

interface Props {
  tool: ToolKind;
  onClose: () => void;
}

export function ShellInstallView({ tool, onClose }: Props) {
  const { t } = useI18n();
  const { state, dispatch } = useShellTools();
  const { install, settings } = state;

  useEffect(() => {
    if (state.tool !== tool) dispatch({ type: "selectTool", tool });
  }, [tool, state.tool, dispatch]);

  useEffect(() => {
    if (tool === "git" || state.tool !== tool) return;
    dispatch({ type: "openInstallList" });
  }, [tool, state.tool, dispatch]);

  if (tool === "git") {
    return (
      <div className="px-5 py-4 text-sm text-dim">
        {t("desktop_shell.git_switch_only")}
        <button type="button" className="ml-2 text-accent underline" onClick={onClose}>
          {t("desktop_shell.close_install")}
        </button>
      </div>
    );
  }

  if (!settings) {
    return <p className="px-5 py-4 text-sm text-dim">{t("app.loading")}</p>;
  }

  const confirmStore = (store: string) => {
    dispatch({
      type: "saveSettings",
      settings: { ...settings, installStore: store, installStoreConfirmed: true },
    });
  };

  return (
    <section className="px-5 py-4 border-b border-rim-subtle shrink-0" aria-labelledby="shell-install-heading">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 id="shell-install-heading" className="text-sm font-semibold">
          {t("desktop_shell.install_heading", { tool: TOOL_DISPLAY[tool].title })}
        </h2>
        <button type="button" className="text-xs text-accent hover:underline" onClick={onClose}>
          {t("desktop_shell.close_install")}
        </button>
      </div>
      {state.error && (
        <div className="text-sm text-danger border border-danger/30 rounded-md px-3 py-2 mb-3">
          {state.error}
        </div>
      )}
      <InstallSection
        tool={tool}
        versions={install.versions}
        loading={install.loading}
        busy={install.busy}
        miseStatus={install.miseStatus}
        settings={settings}
        chosen={install.chosen}
        onChoose={(version) => dispatch({ type: "chooseVersion", version })}
        onConfirmStore={confirmStore}
        onInstall={() => dispatch({ type: "install" })}
      />
    </section>
  );
}
