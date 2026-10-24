import { installStoreGate } from "./installStoreGate";
import { useEffect } from "react";
import { InstallSection } from "../../components/ToolsPanel/InstallSection";
import { useI18n } from "../../hooks/useI18n";
import type { ToolKind } from "../tools/types";
import { INSTALLABLE_TOOL_KINDS, TOOL_DISPLAY } from "./overviewTools";
import { useTools } from "../tools/ToolsContext";

interface Props {
  /** Null until the user picks which tool to install. */
  tool: ToolKind | null;
  onPickTool: (tool: ToolKind) => void;
  onClose: () => void;
}

export function ShellInstallView({ tool, onPickTool, onClose }: Props) {
  const { t } = useI18n();
  const { state, dispatch } = useTools();
  const { install, settings } = state;

  useEffect(() => {
    if (tool && state.tool !== tool) dispatch({ type: "selectTool", tool });
  }, [tool, state.tool, dispatch]);

  useEffect(() => {
    if (!tool || tool === "git" || state.tool !== tool) return;
    if (install.busy || install.catalogTool === tool) return;
    dispatch({ type: "openInstallList" });
  }, [tool, state.tool, install.busy, install.catalogTool, dispatch]);

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

  const catalogError = install.catalogTool === tool ? install.catalogError : null;
  const catalogReady = state.tool === tool && install.catalogTool === tool;

  const storeGate = installStoreGate(settings, dispatch);

  return (
    <section className="px-5 py-4 border-b border-rim-subtle shrink-0" aria-labelledby="shell-install-heading">
      {header}
      {(catalogError || state.error) && (
        <div role="alert" className="text-sm text-danger border border-danger/30 rounded-md px-3 py-2 mb-3">
          {catalogError || state.error}
        </div>
      )}
      {catalogReady && !install.loading && !install.busy && install.versions.length === 0 && (
        <button type="button" className="text-xs text-accent hover:underline mb-3" onClick={() => dispatch({ type: "openInstallList" })}>
          {t("tools.refresh")}
        </button>
      )}
      <InstallSection
        key={tool}
        tool={tool}
        versions={catalogReady ? install.versions : []}
        loading={!catalogReady || install.loading}
        busy={install.busy}
        miseStatus={install.miseStatus}
        settings={settings}
        chosen={catalogReady ? install.chosen : null}
        onChoose={(version) => dispatch({ type: "chooseVersion", version })}
        onConfirmStore={storeGate.onConfirm}
        onInstall={() => dispatch({ type: "install" })}
      />
    </section>
  );
}
