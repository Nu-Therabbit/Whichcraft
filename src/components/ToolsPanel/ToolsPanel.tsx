import { useEffect, useState } from "react";
import type { ToolsDispatch } from "../../features/tools/useToolsStore";
import type { ToolsState } from "../../features/tools/model";
import { useI18n } from "../../hooks/useI18n";
import type { ToolKind } from "../../types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { InstallSection } from "./InstallSection";
import { PathCleanupSummary } from "./PathCleanupSummary";
import { PlanDiffList } from "./PlanDiffList";
import { ProfilesSection } from "./ProfilesSection";
import { RecoveryBanner } from "./RecoveryBanner";
import { ShellCheckResult } from "./ShellCheckResult";
import { PythonLauncherInfo, SdkInventory } from "./SupplementalInfo";
import { ToolsSettings } from "./ToolsSettings";
import { UninstallSection } from "./UninstallSection";
import { UpdateList } from "./UpdateList";

const TOOL_KINDS: ToolKind[] = ["java", "node", "python", "go", "flutter", "git"];

interface Props {
  open: boolean;
  onClose: () => void;
  /** The panel's whole state (MVI model); the panel only reads it. */
  state: ToolsState;
  /** The one way the panel changes anything: it sends intents. */
  dispatch: ToolsDispatch;
}

/** The developer tools panel. Renders `state` and turns every user action into an intent;
 * which tab or section is open is the only state it keeps itself. */
export function ToolsPanel({ open, onClose, state, dispatch }: Props) {
  const { t } = useI18n();
  const [showSettings, setShowSettings] = useState(false);
  const [showSdks, setShowSdks] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const { tool, installations, loading, error, settings, plan, uninstall, update, install, profiles } = state;
  const applyBusy = plan.applying;

  // Opening the panel reads the environment.
  useEffect(() => {
    if (open) dispatch({ type: "refresh" });
  }, [open, dispatch]);

  // The environment can change outside the app; re-read it when the window gets focus again.
  useEffect(() => {
    if (!open) return;
    const onFocus = () => dispatch({ type: "refresh" });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [open, dispatch]);

  // Opening the install list, or switching tools while it is open, lists that tool's versions.
  useEffect(() => {
    if (showInstall && tool !== "git") dispatch({ type: "openInstallList" });
  }, [tool, showInstall, dispatch]);

  // Every refresh (focus, apply, uninstall) gives a new installations list; profile statuses
  // follow it, so a change made outside the app shows up too (F-6).
  // biome-ignore lint/correctness/useExhaustiveDependencies: installations is the refresh signal
  useEffect(() => {
    if (open && showProfiles) dispatch({ type: "loadProfiles" });
  }, [open, showProfiles, dispatch, installations]);

  // Installing, updating and installing what a profile misses all ask for the store first (I-5).
  const confirmStore = (store: string) => {
    if (settings) dispatch({ type: "saveSettings", settings: { ...settings, installStore: store, installStoreConfirmed: true } });
  };
  const storeGate = {
    confirmed: settings?.installStoreConfirmed ?? false,
    installStore: settings?.installStore ?? "",
    onConfirm: confirmStore,
  };

  // Git is switch-only in v1 (Q14).
  const canInstall = tool !== "git";
  const current = plan.current;

  return (
    <Modal open={open} onClose={onClose} title={t("tools.title")} size="xl">
      <div className="flex flex-col gap-4">
        {error && <div className="text-sm text-danger border border-danger/30 rounded-md px-3 py-2">{error}</div>}

        {state.recovery && (
          <RecoveryBanner
            recovery={state.recovery}
            busy={applyBusy}
            onResume={() => dispatch({ type: "resolveRecovery", action: "resume" })}
            onRollBack={() => dispatch({ type: "resolveRecovery", action: "rollBack" })}
          />
        )}

        {state.unfinished.map((u) => (
          <div key={u.id} className="text-sm border border-warning/40 rounded-md px-3 py-2 flex flex-col gap-2">
            <p className="text-warning">
              {t("tools.uninstall.unfinished", {
                name: `${u.installation.vendor} ${u.installation.version}`,
                path: u.installation.root,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => dispatch({ type: "openFolder", path: u.installation.root })}
              >
                {t("tools.uninstall.open_folder")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "dismissUnfinished", id: u.id })}>
                {t("tools.uninstall.rescan")}
              </Button>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2">
          {TOOL_KINDS.map((kind) => (
            <Button
              key={kind}
              variant={kind === tool && !showSdks && !showProfiles ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setShowSdks(false);
                setShowProfiles(false);
                dispatch({ type: "selectTool", tool: kind });
              }}
            >
              {t(`tools.kind.${kind}`)}
            </Button>
          ))}
          <Button
            variant={showSdks ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setShowSdks(true);
              setShowProfiles(false);
              dispatch({ type: "loadSdks" });
            }}
          >
            {t("tools.sdks_tab")}
          </Button>
          <Button
            variant={showProfiles ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setShowProfiles(true);
              setShowSdks(false);
            }}
          >
            {t("tools.profiles_tab")}
          </Button>
        </div>

        {showSdks && <SdkInventory android={state.sdks.android} msvc={state.sdks.msvc} />}

        {showProfiles && (
          <ProfilesSection
            profiles={profiles.list}
            current={profiles.current}
            missing={profiles.missing}
            busy={profiles.busy || applyBusy}
            onCreate={(name, pins) => dispatch({ type: "createProfile", name, tools: pins })}
            onDelete={(id) => dispatch({ type: "deleteProfile", id })}
            onApply={(profile) => dispatch({ type: "planProfile", profile })}
            onCheckMissing={(profile) => dispatch({ type: "checkMissing", profile })}
            onInstallMissing={(profile) => dispatch({ type: "installMissing", profile })}
            store={storeGate}
          />
        )}

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "refresh" })} disabled={loading}>
            {t("tools.refresh")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "undoLast" })} disabled={applyBusy}>
            {t("tools.undo_last")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "checkShell" })} disabled={loading}>
            {t("tools.check_in_shell")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "openTerminal" })}>
            {t("tools.open_terminal")}
          </Button>
          {canInstall && (
            <Button variant="ghost" size="sm" onClick={() => setShowInstall((v) => !v)}>
              {t("tools.install_version")}
            </Button>
          )}
          {canInstall && (
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "checkUpdates" })} disabled={update.busy}>
              {t("tools.check_updates")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch({ type: "planCleanup" })}
            disabled={plan.building || applyBusy}
          >
            {t("tools.cleanup.button")}
          </Button>
          {settings && (
            <Button variant="ghost" size="sm" onClick={() => setShowSettings((v) => !v)}>
              {showSettings ? t("tools.hide_settings") : t("tools.show_settings")}
            </Button>
          )}
        </div>

        {showSettings && settings && (
          <div className="border border-rim rounded-md p-4">
            <ToolsSettings
              settings={settings}
              busy={applyBusy || loading}
              onSave={(next) => dispatch({ type: "saveSettings", settings: next })}
            />
          </div>
        )}

        <p className="text-sm text-muted">{t("tools.discovery_hint")}</p>

        <div className="border border-rim rounded-md divide-y divide-rim max-h-64 overflow-auto">
          {loading && installations.length === 0 ? (
            <div className="p-4 text-sm text-muted">{t("app.loading")}</div>
          ) : installations.length === 0 ? (
            <div className="p-4 text-sm text-muted">{t("tools.no_installations")}</div>
          ) : (
            installations.map((item) => (
              <div key={item.root} className="flex items-start">
                <button
                  type="button"
                  className="flex-1 text-left px-4 py-3 hover:bg-surface/60 flex flex-col gap-1 disabled:opacity-50"
                  onClick={() => dispatch({ type: "buildPlan", root: item.root })}
                  disabled={!item.available}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {item.vendor} {item.version}
                    </span>
                    {item.effective && <Badge variant="user">{t("tools.effective")}</Badge>}
                    {item.selected && <Badge variant="muted">{t("tools.selected")}</Badge>}
                    {!item.available && <Badge variant="warn">{t("tools.unavailable")}</Badge>}
                    <Badge variant="muted">{t(`tools.installer.${item.installerKind}`)}</Badge>
                  </div>
                  <span className="text-xs text-muted font-mono wrap-anywhere">{item.root}</span>
                  {item.mismatchReason && <span className="text-xs text-warning">{item.mismatchReason}</span>}
                </button>
                {item.available && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="m-3"
                    disabled={uninstall.busy}
                    onClick={() => dispatch({ type: "planUninstall", root: item.root })}
                  >
                    {t("tools.uninstall_button")}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {state.shellCheck && state.shellCheck.tool === tool && <ShellCheckResult check={state.shellCheck} />}

        {showInstall && canInstall && settings && (
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
        )}

        {canInstall && update.list && (
          <UpdateList
            updates={update.list}
            busy={update.busy}
            awaitingSwitch={update.pending !== null}
            onUpdate={(candidate) => dispatch({ type: "update", candidate })}
            store={storeGate}
            repoint={
              update.pending?.repoint && {
                names: update.pending.repoint.names,
                checked: update.pending.repoint.checked,
                onToggle: (checked) => dispatch({ type: "toggleRepoint", checked }),
              }
            }
          />
        )}

        <UninstallSection
          key={uninstall.plan?.installation.root ?? "none"}
          plan={uninstall.plan}
          outcome={uninstall.outcome}
          busy={uninstall.busy}
          defaultReplacement={uninstall.defaultReplacement}
          switchPlan={uninstall.switchPlan}
          onChooseReplacement={(root) => dispatch({ type: "chooseReplacement", root })}
          onConfirm={(replacementRoot, repoint) => dispatch({ type: "confirmUninstall", replacementRoot, repoint })}
          onOpenFolder={(path) => dispatch({ type: "openFolder", path })}
          onClose={() => dispatch({ type: "closeUninstall" })}
        />

        {tool === "python" && state.pythonInfo && <PythonLauncherInfo info={state.pythonInfo} />}

        {plan.cleanup && (current?.recordsSelection === false || !current) && (
          <PathCleanupSummary
            duplicates={plan.cleanup.duplicates}
            missing={plan.cleanup.missing}
            pending={current?.recordsSelection === false}
          />
        )}

        {current && (
          <div className="border border-rim rounded-md p-4 flex flex-col gap-3 bg-surface/40">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">{t("tools.plan_title")}</h3>
              <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "clearPlan" })}>
                {t("tools.dismiss_plan")}
              </Button>
            </div>
            <PlanDiffList plan={current} />
            <Button
              variant="primary"
              onClick={() => dispatch({ type: "applyPlan" })}
              disabled={applyBusy || plan.building}
            >
              {applyBusy ? t("tools.applying") : t("tools.apply_plan")}
            </Button>
          </div>
        )}

        {plan.building && !current && <p className="text-sm text-muted">{t("tools.building_plan")}</p>}
      </div>
    </Modal>
  );
}
