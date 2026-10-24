import { PlanDiffList } from "../../components/ToolsPanel/PlanDiffList";
import { ShellCheckResult } from "../../components/ToolsPanel/ShellCheckResult";
import { UninstallSection } from "../../components/ToolsPanel/UninstallSection";
import { UpdateList } from "../../components/ToolsPanel/UpdateList";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import type { ToolsDispatch } from "../tools/useToolsStore";
import type { ToolsState } from "../tools/model";
import { useI18n } from "../../hooks/useI18n";
import type { ToolInstallationView, ToolKind } from "../tools/types";

interface Props {
  tool: ToolKind;
  state: ToolsState;
  dispatch: ToolsDispatch;
}

export function ShellInstallationDetail({ tool, state, dispatch }: Props) {
  const { t } = useI18n();
  const { installations, loading, error, plan, uninstall, unfinished, shellCheck, update, settings } = state;
  const applyBusy = plan.applying;
  const current = plan.current;
  const canInstall = tool !== "git";
  const storeGate = settings
    ? {
        confirmed: settings.installStoreConfirmed ?? false,
        installStore: settings.installStore,
        onConfirm: (installStore: string) =>
          dispatch({
            type: "saveSettings",
            settings: { ...settings, installStore, installStoreConfirmed: true },
          }),
      }
    : { confirmed: false, installStore: "", onConfirm: () => {} };

  if (state.tool !== tool) {
    return <p className="text-xs text-dim py-2">{t("desktop_shell.loading")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="text-xs text-danger border border-danger/30 rounded-md px-3 py-2" role="alert">
          {error}
        </div>
      )}

      {unfinished.map((u) => (
        <div
          key={u.id}
          className="text-xs border border-warning/40 rounded-md px-3 py-2 flex flex-col gap-2"
        >
          <p className="text-warning">
            {t("tools.uninstall.unfinished", {
              name: `${u.installation.vendor} ${u.installation.version}`,
              path: u.installation.root,
            })}
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => dispatch({ type: "openFolder", path: u.installation.root })}
            >
              {t("tools.uninstall.open_folder")}
            </Button>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => dispatch({ type: "dismissUnfinished", id: u.id })}
            >
              {t("tools.uninstall.rescan")}
            </Button>
          </div>
        </div>
      ))}

      {plan.undoResult && (
        <div className="text-xs border border-rim-subtle rounded-md px-3 py-2 space-y-1">
          {plan.undoResult.conflicts.length > 0 ? (
            <>
              <p className="text-warn font-medium">{t("desktop_shell.undo_conflicts")}</p>
              <ul className="list-disc pl-4 text-dim">
                {plan.undoResult.conflicts.map((c) => (
                  <li key={`${c.scope}-${c.name}`}>
                    {c.scope} {c.name}: {c.message}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-success">{t("desktop_shell.undo_restored", { count: plan.undoResult.restored })}</p>
          )}
          <Button variant="ghost" size="xs" onClick={() => dispatch({ type: "clearUndoResult" })}>
            {t("desktop_shell.dismiss_undo_result")}
          </Button>
        </div>
      )}

      <div>
        <h3 className="text-[11px] uppercase tracking-wide text-dim flex justify-between">
          <span>{t("desktop_shell.installations")}</span>
          <span>{installations.length}</span>
        </h3>
        {loading && installations.length === 0 && (
          <p className="text-xs text-dim py-2">{t("desktop_shell.loading")}</p>
        )}
        {!loading && installations.length === 0 && (
          <p className="text-xs text-dim py-2">{t("desktop_shell.no_installations")}</p>
        )}
        <ul className="space-y-2 mt-2">
          {installations.map((item) => (
            <InstallationSwitchRow
              key={item.root}
              item={item}
              planRoot={current?.selected.root ?? null}
              building={plan.building}
              applyBusy={applyBusy}
              uninstallBusy={uninstall.busy}
              onChoose={() => dispatch({ type: "buildPlan", root: item.root })}
              onUninstall={() => dispatch({ type: "planUninstall", root: item.root })}
            />
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="xs"
          onClick={() => dispatch({ type: "checkShell" })}
          disabled={loading || applyBusy}
        >
          {t("tools.check_in_shell")}
        </Button>
        <Button variant="secondary" size="xs" onClick={() => dispatch({ type: "openTerminal" })} disabled={applyBusy}>
          {t("tools.open_terminal")}
        </Button>
        {canInstall && (
          <Button
            variant="secondary"
            size="xs"
            onClick={() => dispatch({ type: "checkUpdates" })}
            disabled={update.busy || applyBusy}
          >
            {t("tools.check_updates")}
          </Button>
        )}
      </div>

      <p className="text-[11px] text-dim">{t("desktop_shell.shell_check_hint")}</p>

      {shellCheck && shellCheck.tool === tool && <ShellCheckResult check={shellCheck} />}

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

      {plan.building && !current && (
        <p className="text-xs text-dim">{t("tools.building_plan")}</p>
      )}

      {current && current.tool === tool && plan.source !== "profile" && plan.source !== "cleanup" && (
        <section className="border border-rim-subtle rounded-md p-3 flex flex-col gap-3 bg-surface/40">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">{t("tools.plan_title")}</h3>
            <Button variant="ghost" size="xs" onClick={() => dispatch({ type: "clearPlan" })}>
              {t("tools.dismiss_plan")}
            </Button>
          </div>
          <PlanDiffList plan={current} />
          <Button
            variant="primary"
            size="sm"
            onClick={() => dispatch({ type: "applyPlan" })}
            disabled={applyBusy || plan.building}
          >
            {applyBusy ? t("tools.applying") : t("tools.apply_plan")}
          </Button>
        </section>
      )}

      <UninstallSection
        key={uninstall.plan?.installation.root ?? "none"}
        plan={uninstall.plan}
        outcome={uninstall.outcome}
        busy={uninstall.busy}
        defaultReplacement={uninstall.defaultReplacement}
        switchPlan={uninstall.switchPlan}
        onChooseReplacement={(root) => dispatch({ type: "chooseReplacement", root })}
        onConfirm={(replacementRoot, repoint) =>
          dispatch({ type: "confirmUninstall", replacementRoot, repoint })
        }
        onOpenFolder={(path) => dispatch({ type: "openFolder", path })}
        onClose={() => dispatch({ type: "closeUninstall" })}
      />

      <div className="flex flex-wrap gap-2 pt-1 border-t border-rim-subtle">
        <Button variant="secondary" size="xs" onClick={() => dispatch({ type: "undoLast" })} disabled={applyBusy}>
          {t("tools.undo_last")}
        </Button>
      </div>
    </div>
  );
}

function InstallationSwitchRow({
  item,
  planRoot,
  building,
  applyBusy,
  uninstallBusy,
  onChoose,
  onUninstall,
}: {
  item: ToolInstallationView;
  planRoot: string | null;
  building: boolean;
  applyBusy: boolean;
  uninstallBusy: boolean;
  onChoose: () => void;
  onUninstall: () => void;
}) {
  const { t } = useI18n();
  const reviewing = planRoot === item.root;
  return (
    <li
      className={`rounded border px-3 py-2 text-sm ${
        reviewing ? "border-accent bg-surface" : item.available ? "border-rim-subtle bg-panel" : "border-warn/40 bg-warn/5 opacity-90"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <strong className="font-mono text-xs">{item.version}</strong>
        <span className="text-dim text-xs">{item.vendor}</span>
        {item.effective && <Badge variant="user">{t("tools.effective")}</Badge>}
        {item.selected && !item.effective && <Badge variant="muted">{t("tools.selected")}</Badge>}
        {!item.available && <Badge variant="warn">{t("tools.unavailable")}</Badge>}
      </div>
      <code className="block mt-1 text-xs text-muted break-all">{item.root}</code>
      {!item.available && item.mismatchReason && (
        <p className="text-[11px] text-dim mt-1">{item.mismatchReason}</p>
      )}
      <div className="flex flex-wrap gap-2 mt-2">
        <Button
          variant={reviewing ? "primary" : "secondary"}
          size="xs"
          disabled={!item.available || building || applyBusy}
          aria-label={t("desktop_shell.switch_to_installation", {
            vendor: item.vendor,
            version: item.version,
          })}
          onClick={onChoose}
        >
          {reviewing ? t("desktop_shell.reviewing_plan") : t("desktop_shell.use_installation")}
        </Button>
        {item.available && (
          <Button variant="ghost" size="xs" disabled={uninstallBusy} onClick={onUninstall}>
            {t("tools.uninstall_button")}
          </Button>
        )}
      </div>
    </li>
  );
}
