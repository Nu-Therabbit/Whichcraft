import { installStoreGate } from "./installStoreGate";
import { useEffect } from "react";
import { InstallSection } from "../../components/ToolsPanel/InstallSection";
import { Button } from "../../components/ui/Button";
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

  const header = (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 id="shell-install-heading" className="shell-dialog-title">
        {tool && tool !== "git"
          ? t("desktop_shell.install_heading", { tool: TOOL_DISPLAY[tool].title })
          : t("desktop_shell.install_pick_heading")}
      </h2>
      <Button variant="ghost" size="xs" onClick={onClose}>
        {t("desktop_shell.close_install")}
      </Button>
    </div>
  );

  // The tool stays changeable here, because the dialog hides the cards it was opened from.
  const picker = (
    <fieldset aria-labelledby="shell-install-heading" className="mb-3 flex flex-wrap gap-2">
      {INSTALLABLE_TOOL_KINDS.map((kind) => (
        <label
          key={kind}
          className={`flex items-center gap-2 rounded-control border px-3 py-1.5 hover:bg-hover has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${tool === kind ? "border-accent bg-selection" : "border-rim-subtle"}`}
        >
          <input
            type="radio"
            name="shell-install-tool"
            className="accent-accent"
            checked={tool === kind}
            onChange={() => onPickTool(kind)}
          />
          {TOOL_DISPLAY[kind].title}
        </label>
      ))}
    </fieldset>
  );

  if (tool === "git") {
    return (
      <section className="p-5" aria-labelledby="shell-install-heading">
        {header}
        {picker}
        <p className="text-dim">{t("desktop_shell.git_switch_only")}</p>
      </section>
    );
  }

  if (!tool) {
    return (
      <section className="p-5" aria-labelledby="shell-install-heading">
        {header}
        {picker}
      </section>
    );
  }

  if (!settings) {
    return <p className="p-5 text-dim">{t("app.loading")}</p>;
  }

  const catalogError = install.catalogTool === tool ? install.catalogError : null;
  const catalogReady = state.tool === tool && install.catalogTool === tool;

  const storeGate = installStoreGate(settings, dispatch);

  return (
    <section className="p-5" aria-labelledby="shell-install-heading">
      {header}
      {picker}
      {(catalogError || state.error) && (
        <div role="alert" className="shell-banner mb-3 text-danger" data-tone="warn">
          {catalogError || state.error}
        </div>
      )}
      {catalogReady && !install.loading && !install.busy && install.versions.length === 0 && (
        <Button variant="secondary" size="xs" className="mb-3" onClick={() => dispatch({ type: "openInstallList" })}>
          {t("tools.refresh")}
        </Button>
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
