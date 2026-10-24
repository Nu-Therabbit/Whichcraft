import { useEffect } from "react";
import { InstallSection } from "../../components/ToolsPanel/InstallSection";
import { useI18n } from "../../hooks/useI18n";
import type { ToolKind } from "../tools/types";
import { INSTALLABLE_TOOL_KINDS, TOOL_DISPLAY } from "./overviewTools";
import { useShellTools } from "./ShellToolsContext";

interface Props {
  /** Null until the user picks which tool to install. */
  tool: ToolKind | null;
  onPickTool: (tool: ToolKind) => void;
  onClose: () => void;
}

export function ShellInstallView({ tool, onPickTool, onClose }: Props) {
  const { t } = useI18n();
  const { state, dispatch } = useShellTools();
  const { install, settings } = state;

  useEffect(() => {
    if (tool && state.tool !== tool) dispatch({ type: "selectTool", tool });
  }, [tool, state.tool, dispatch]);

  useEffect(() => {
    if (!tool || tool === "git" || state.tool !== tool) return;
    if (install.busy || install.loading || install.versions.length > 0) return;
    dispatch({ type: "openInstallList" });
  }, [tool, state.tool, install.busy, install.loading, install.versions.length, dispatch]);

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

  const header = (
    <div className="flex items-center justify-between gap-2 mb-3">
      <h2 id="shell-install-heading" className="text-sm font-semibold">
        {tool
          ? t("desktop_shell.install_heading", { tool: TOOL_DISPLAY[tool].title })
          : t("desktop_shell.install_pick_heading")}
      </h2>
      <button type="button" className="text-xs text-accent hover:underline" onClick={onClose}>
        {t("desktop_shell.close_install")}
      </button>
    </div>
  );

  if (!tool) {
    return (
      <section className="px-5 py-4 border-b border-rim-subtle shrink-0" aria-labelledby="shell-install-heading">
        {header}
        <fieldset aria-labelledby="shell-install-heading" className="flex flex-wrap gap-2">
          {INSTALLABLE_TOOL_KINDS.map((kind) => (
            <label
              key={kind}
              className="flex items-center gap-2 rounded border border-rim-subtle bg-panel px-3 py-1.5 text-sm hover:bg-hover has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
            >
              <input
                type="radio"
                name="shell-install-tool"
                className="accent-accent"
                onChange={() => onPickTool(kind)}
              />
              {TOOL_DISPLAY[kind].title}
            </label>
          ))}
        </fieldset>
      </section>
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
      {header}
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
