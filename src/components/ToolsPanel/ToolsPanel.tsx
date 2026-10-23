import { useEffect, useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import { pathEntryChanges } from "../../lib/pathEntryChanges";
import type {
  AndroidInventory,
  MiseStatus,
  MissingPin,
  MsvcInventory,
  ProfileMatchStatus,
  ProfileToolPin,
  PythonSupplementalView,
  RecoveryView,
  RemoteVersion,
  ShellCheck,
  ToolApplyPlan,
  ToolInstallationView,
  ToolKind,
  ToolProfile,
  UninstallOutcome,
  UninstallPlan,
  UpdateCandidate,
  WhichcraftSettings,
} from "../../types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { InstallSection } from "./InstallSection";
import { RecoveryBanner } from "./RecoveryBanner";
import { ShellCheckResult } from "./ShellCheckResult";
import { PythonLauncherInfo, SdkInventory } from "./SupplementalInfo";
import { ToolsSettings } from "./ToolsSettings";
import { UninstallSection } from "./UninstallSection";
import { PathCleanupSummary } from "./PathCleanupSummary";
import { ProfilesSection } from "./ProfilesSection";
import { UpdateList } from "./UpdateList";

const TOOL_KINDS: ToolKind[] = ["java", "node", "python", "go", "flutter", "git"];

/** A PATH change as the entries it adds and removes; the whole value is too long to compare by eye. */
function PathEntryDiff({ before, after }: { before: string | null; after: string }) {
  const { added, removed } = pathEntryChanges(before, after);
  return (
    <ul className="text-xs break-all">
      {added.map((e) => (
        <li key={`+${e}`} className="text-success">
          + {e}
        </li>
      ))}
      {removed.map((e, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a removed entry can repeat
        <li key={`-${e}-${i}`} className="text-danger line-through">
          − {e}
        </li>
      ))}
    </ul>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  tool: ToolKind;
  onToolChange: (tool: ToolKind) => void;
  installations: ToolInstallationView[];
  loading: boolean;
  error: string | null;
  plan: ToolApplyPlan | null;
  planBusy: boolean;
  applyBusy: boolean;
  onRefresh: () => void;
  onSelect: (root: string) => void;
  onApplyPlan: () => void;
  onUndo: () => void;
  onClearPlan: () => void;
  recovery?: RecoveryView | null;
  onResumeRecovery?: () => void;
  onRollBackRecovery?: () => void;
  settings?: WhichcraftSettings | null;
  onSaveSettings?: (settings: WhichcraftSettings) => void;
  pythonInfo?: PythonSupplementalView | null;
  android?: AndroidInventory | null;
  msvc?: MsvcInventory | null;
  onLoadSdks?: () => void;
  shellCheck?: ShellCheck | null;
  onShellCheck?: () => void;
  onOpenTerminal?: () => void;
  install?: {
    versions: RemoteVersion[];
    loading: boolean;
    busy: boolean;
    miseStatus: MiseStatus | null;
    chosen: { version: string; downloadBytes: number | null } | null;
    onOpen: () => void;
    onChoose: (version: string) => void;
    onInstall: () => void;
  };
  pathCleanup?: {
    result: { duplicates: string[]; missing: string[] } | null;
    onPlan: () => void;
  };
  updates?: {
    list: UpdateCandidate[] | null;
    busy: boolean;
    awaitingSwitch: boolean;
    onCheck: () => void;
    onUpdate: (candidate: UpdateCandidate) => void;
  };
  profiles?: {
    list: ProfileMatchStatus[];
    current: ProfileToolPin[];
    missing: { profileId: string; items: MissingPin[] } | null;
    busy: boolean;
    onLoad: () => void;
    onCreate: (name: string, tools: ProfileToolPin[]) => void;
    onDelete: (id: string) => void;
    onApply: (profile: ToolProfile) => void;
    onCheckMissing: (profile: ToolProfile) => void;
    onInstallMissing: (profile: ToolProfile) => void;
  };
  uninstall?: {
    plan: UninstallPlan | null;
    outcome: UninstallOutcome | null;
    busy: boolean;
    defaultReplacement?: string | null;
    onPlan: (root: string) => void;
    onConfirm: (replacementRoot: string | null, repointProfiles: boolean) => void;
    onOpenFolder: (path: string) => void;
    onClose: () => void;
  };
}

export function ToolsPanel({
  open,
  onClose,
  tool,
  onToolChange,
  installations,
  loading,
  error,
  plan,
  planBusy,
  applyBusy,
  onRefresh,
  onSelect,
  onApplyPlan,
  onUndo,
  onClearPlan,
  recovery,
  onResumeRecovery,
  onRollBackRecovery,
  settings,
  onSaveSettings,
  pythonInfo,
  android,
  msvc,
  onLoadSdks,
  shellCheck,
  onShellCheck,
  onOpenTerminal,
  install,
  updates,
  profiles,
  uninstall,
  pathCleanup,
}: Props) {
  const { t } = useI18n();
  const [showSettings, setShowSettings] = useState(false);
  const [showSdks, setShowSdks] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const loadProfiles = profiles?.onLoad;

  // Every refresh (focus, apply, uninstall) gives a new installations list; profile statuses
  // follow it, so a change made outside the app shows up too (F-6).
  // biome-ignore lint/correctness/useExhaustiveDependencies: installations is the refresh signal
  useEffect(() => {
    if (open && showProfiles) loadProfiles?.();
  }, [open, showProfiles, loadProfiles, installations]);
  // Git is switch-only in v1 (Q14).
  const canInstall = tool !== "git" && !!install;
  const loadInstallable = install?.onOpen;

  // Switching tools while the install list is open lists the new tool's versions.
  useEffect(() => {
    if (showInstall && tool !== "git") loadInstallable?.();
  }, [tool, showInstall, loadInstallable]);

  // onRefresh changes identity whenever the selected tool changes, so this also refreshes on tool switch.
  useEffect(() => {
    if (open) onRefresh();
  }, [open, onRefresh]);

  // The environment can change outside the app; re-read it when the window gets focus again.
  useEffect(() => {
    if (!open) return;
    const onFocus = () => onRefresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [open, onRefresh]);

  return (
    <Modal open={open} onClose={onClose} title={t("tools.title")} size="xl">
      <div className="flex flex-col gap-4">
        {error && (
          <div className="text-sm text-danger border border-danger/30 rounded-md px-3 py-2">{error}</div>
        )}

        {recovery && onResumeRecovery && onRollBackRecovery && (
          <RecoveryBanner
            recovery={recovery}
            busy={applyBusy}
            onResume={onResumeRecovery}
            onRollBack={onRollBackRecovery}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {TOOL_KINDS.map((kind) => (
            <Button
              key={kind}
              variant={kind === tool && !showSdks && !showProfiles ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setShowSdks(false);
                setShowProfiles(false);
                onToolChange(kind);
              }}
            >
              {t(`tools.kind.${kind}`)}
            </Button>
          ))}
          {onLoadSdks && (
            <Button
              variant={showSdks ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setShowSdks(true);
                setShowProfiles(false);
                onLoadSdks();
              }}
            >
              {t("tools.sdks_tab")}
            </Button>
          )}
          {profiles && (
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
          )}
        </div>

        {showSdks && <SdkInventory android={android ?? null} msvc={msvc ?? null} />}

        {showProfiles && profiles && (
          <ProfilesSection
            profiles={profiles.list}
            current={profiles.current}
            missing={profiles.missing}
            busy={profiles.busy || applyBusy}
            onCreate={profiles.onCreate}
            onDelete={profiles.onDelete}
            onApply={profiles.onApply}
            onCheckMissing={profiles.onCheckMissing}
            onInstallMissing={profiles.onInstallMissing}
          />
        )}

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
            {t("tools.refresh")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onUndo} disabled={applyBusy}>
            {t("tools.undo_last")}
          </Button>
          {onShellCheck && (
            <Button variant="ghost" size="sm" onClick={onShellCheck} disabled={loading}>
              {t("tools.check_in_shell")}
            </Button>
          )}
          {onOpenTerminal && (
            <Button variant="ghost" size="sm" onClick={onOpenTerminal}>
              {t("tools.open_terminal")}
            </Button>
          )}
          {canInstall && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInstall((v) => !v)}
            >
              {t("tools.install_version")}
            </Button>
          )}
          {canInstall && updates && (
            <Button variant="ghost" size="sm" onClick={updates.onCheck} disabled={updates.busy}>
              {t("tools.check_updates")}
            </Button>
          )}
          {pathCleanup && (
            <Button variant="ghost" size="sm" onClick={pathCleanup.onPlan} disabled={planBusy || applyBusy}>
              {t("tools.cleanup.button")}
            </Button>
          )}
          {settings && onSaveSettings && (
            <Button variant="ghost" size="sm" onClick={() => setShowSettings((v) => !v)}>
              {showSettings ? t("tools.hide_settings") : t("tools.show_settings")}
            </Button>
          )}
        </div>

        {showSettings && settings && onSaveSettings && (
          <div className="border border-rim rounded-md p-4">
            <ToolsSettings settings={settings} busy={applyBusy || loading} onSave={onSaveSettings} />
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
                  onClick={() => onSelect(item.root)}
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
                  <span className="text-xs text-muted font-mono break-all">{item.root}</span>
                  {item.mismatchReason && (
                    <span className="text-xs text-warning">{item.mismatchReason}</span>
                  )}
                </button>
                {uninstall && item.available && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="m-3"
                    disabled={uninstall.busy}
                    onClick={() => uninstall.onPlan(item.root)}
                  >
                    {t("tools.uninstall_button")}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {shellCheck && shellCheck.tool === tool && <ShellCheckResult check={shellCheck} />}

        {showInstall && canInstall && install && settings && onSaveSettings && (
          <InstallSection
            tool={tool}
            versions={install.versions}
            loading={install.loading}
            busy={install.busy}
            miseStatus={install.miseStatus}
            settings={settings}
            chosen={install.chosen}
            onChoose={install.onChoose}
            onConfirmStore={(store) => onSaveSettings({ ...settings, installStore: store, installStoreConfirmed: true })}
            onInstall={install.onInstall}
          />
        )}

        {canInstall && updates?.list && (
          <UpdateList
            updates={updates.list}
            busy={updates.busy}
            awaitingSwitch={updates.awaitingSwitch}
            onUpdate={updates.onUpdate}
          />
        )}

        {uninstall && (
          <UninstallSection
            key={uninstall.plan?.installation.root ?? "none"}
            plan={uninstall.plan}
            outcome={uninstall.outcome}
            busy={uninstall.busy}
            defaultReplacement={uninstall.defaultReplacement}
            onConfirm={uninstall.onConfirm}
            onOpenFolder={uninstall.onOpenFolder}
            onClose={uninstall.onClose}
          />
        )}

        {tool === "python" && pythonInfo && <PythonLauncherInfo info={pythonInfo} />}

        {pathCleanup?.result && (plan?.recordsSelection === false || !plan) && (
          <PathCleanupSummary
            duplicates={pathCleanup.result.duplicates}
            missing={pathCleanup.result.missing}
            pending={plan?.recordsSelection === false}
          />
        )}

        {plan && (
          <div className="border border-rim rounded-md p-4 flex flex-col gap-3 bg-surface/40">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">{t("tools.plan_title")}</h3>
              <Button variant="ghost" size="sm" onClick={onClearPlan}>
                {t("tools.dismiss_plan")}
              </Button>
            </div>
            {plan.requiresUac && (
              <p className="text-xs text-warning">{t("tools.uac_required")}</p>
            )}
            {plan.warnings.map((w) => (
              <p key={w} className="text-xs text-warning">
                {w}
              </p>
            ))}
            <p className="text-xs text-muted">{plan.limitationNotice}</p>
            <ul className="text-sm font-mono space-y-2">
              {[...plan.userDiffs, ...plan.systemDiffs].map((d) => (
                <li key={`${d.scope}-${d.name}`}>
                  <span className="text-muted">
                    {d.scope} {d.name}
                  </span>
                  {d.name.toLowerCase() === "path" ? (
                    <PathEntryDiff before={d.before} after={d.after} />
                  ) : (
                    <>
                      <div className="text-xs text-danger line-through truncate">{d.before ?? "(empty)"}</div>
                      <div className="text-xs text-success truncate">{d.after}</div>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <Button variant="primary" onClick={onApplyPlan} disabled={applyBusy || planBusy}>
              {applyBusy ? t("tools.applying") : t("tools.apply_plan")}
            </Button>
          </div>
        )}

        {planBusy && !plan && <p className="text-sm text-muted">{t("tools.building_plan")}</p>}
      </div>
    </Modal>
  );
}
