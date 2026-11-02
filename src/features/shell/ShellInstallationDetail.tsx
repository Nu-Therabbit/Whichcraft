import { type ReactNode, useEffect } from "react";
import { installStoreGate } from "./installStoreGate";
import { ShellCheckResult } from "../../components/ToolsPanel/ShellCheckResult";
import { UpdateList } from "../../components/ToolsPanel/UpdateList";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import type { ToolsDispatch } from "../tools/useToolsStore";
import type { ToolsState } from "../tools/model";
import { mismatchReasonText } from "../tools/mismatchReason";
import { useI18n } from "../../hooks/useI18n";
import { ShellUndoResult } from "./ShellUndoResult";
import { TOOL_DISPLAY } from "./overviewTools";
import { byVersion, pickEffective, pickSelected } from "./toolOverviewModel";
import { useArrival } from "./useArrival";
import type { ToolInstallationView, ToolKind } from "../tools/types";

interface Props {
  tool: ToolKind;
  state: ToolsState;
  dispatch: ToolsDispatch;
  onInstall: () => void;
  /** What the last Apply did, held above the sheet so it outlives it. */
  notice: ReactNode;
}

export function ShellInstallationDetail({ tool, state, dispatch, onInstall, notice }: Props) {
  const { t } = useI18n();
  const { installations, loading, error, plan, uninstall, shellCheck, update, settings, profiles } = state;
  const applyBusy = plan.applying;
  const current = plan.current;
  const canInstall = tool !== "git";
  const storeGate = installStoreGate(settings, dispatch);
  const items = byVersion(state.tool === tool ? installations : []);
  const arrived = useArrival(items);

  useEffect(() => {
    dispatch({ type: "loadProfiles" });
  }, [dispatch]);

  if (state.tool !== tool) {
    return <p className="py-2 text-xs text-dim">{t("desktop_shell.loading")}</p>;
  }

  const effective = pickEffective(installations);
  const selected = pickSelected(installations);
  const mismatch = selected !== null && effective !== null && selected.root !== effective.root;
  const pins = profiles.list.flatMap((status) =>
    status.profile.tools.filter((pin) => pin.tool === tool).map((pin) => ({ status, pin })),
  );

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="shell-banner text-danger" data-tone="warn" role="alert">
          {error}
        </div>
      )}

      {notice}

      <ShellUndoResult state={state} dispatch={dispatch} />

      {mismatch && selected && (
        <div className="shell-banner" data-tone="warn">
          <span className="shell-banner-tile text-warn">
            <Icon name="warning" size={16} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t("desktop_shell.mismatch_title")}</span>
            {selected.mismatchReason && <span className="block text-xs text-muted">{mismatchReasonText(selected.mismatchReason, t)}</span>}
          </span>
          {selected.available && (
            <Button variant="primary" size="sm" disabled={plan.building || applyBusy} onClick={() => dispatch({ type: "buildPlan", root: selected.root })}>
              {t("desktop_shell.use_version", { version: selected.version })}
            </Button>
          )}
        </div>
      )}

      <section>
        <h2 className="shell-section-title mb-2">{t("desktop_shell.installations")}</h2>
        <div className="shell-panel">
          {loading && installations.length === 0 && <p className="p-3 text-xs text-dim">{t("desktop_shell.loading")}</p>}
          {!loading && installations.length === 0 && <p className="p-3 text-muted">{t("desktop_shell.no_installations")}</p>}
          <ul>
            {items.map((item) => (
              <InstallationSwitchRow
                key={item.root}
                item={item}
                arrived={arrived === item.root}
                planRoot={current?.selected.root ?? null}
                building={plan.building}
                applyBusy={applyBusy}
                uninstallBusy={uninstall.busy}
                onChoose={() => dispatch({ type: "buildPlan", root: item.root })}
                onOpenFolder={() => dispatch({ type: "openFolder", path: item.root })}
                onUninstall={() => dispatch({ type: "planUninstall", root: item.root })}
              />
            ))}
          </ul>
        </div>
        {plan.building && !current && <p className="mt-2 text-xs text-dim">{t("tools.building_plan")}</p>}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="shell-section-title min-w-0 flex-1">{t("desktop_shell.shell_resolution")}</h2>
          <Button variant="secondary" size="xs" onClick={() => dispatch({ type: "checkShell" })} disabled={loading || applyBusy}>
            {t("tools.check_in_shell")}
          </Button>
        </div>
        <div className="shell-panel flex flex-col gap-3 p-3">
          <p className="text-xs text-dim">{t("desktop_shell.shell_check_hint")}</p>
          {shellCheck && shellCheck.tool === tool && <ShellCheckResult check={shellCheck} />}
        </div>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-3">
        <section>
          <h2 className="shell-section-title mb-2">{t("desktop_shell.page_profiles")}</h2>
          <div className="shell-panel">
            {pins.length === 0 && <p className="p-3 text-muted">{t("desktop_shell.profile_none_for_tool", { tool: TOOL_DISPLAY[tool].title })}</p>}
            {pins.map(({ status, pin }) => (
              <div key={status.profile.id} className="shell-panel-row flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{status.profile.name}</span>
                  <span className="block truncate text-xs tabular-nums text-muted">
                    {pin.vendor} {pin.version}
                  </span>
                </span>
                {status.matchesEffective ? (
                  <span className="shell-pill shell-pill-ok">{t("tools.profiles.matches")}</span>
                ) : (
                  status.unavailable.length === 0 && (
                    <Button
                      variant="secondary"
                      size="xs"
                      aria-label={t("desktop_shell.profile_apply", { name: status.profile.name })}
                      disabled={profiles.busy || plan.building || applyBusy}
                      onClick={() => dispatch({ type: "planProfile", profile: status.profile })}
                    >
                      {t("tools.profiles.apply")}
                    </Button>
                  )
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="shell-section-title mb-2">{t("desktop_shell.versions_section")}</h2>
          <div className="shell-panel flex flex-col gap-3 p-3">
            <div className="flex flex-wrap gap-2">
              {canInstall && (
                <Button variant="secondary" size="xs" onClick={onInstall}>
                  {t("desktop_shell.install_another")}
                </Button>
              )}
              {canInstall && (
                <Button variant="secondary" size="xs" onClick={() => dispatch({ type: "checkUpdates" })} disabled={update.busy || applyBusy}>
                  {t("tools.check_updates")}
                </Button>
              )}
              <Button variant="secondary" size="xs" onClick={() => dispatch({ type: "undoLast" })} disabled={applyBusy}>
                {t("tools.undo_last")}
              </Button>
            </div>
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
          </div>
        </section>
      </div>
    </div>
  );
}

function InstallationSwitchRow({
  item,
  arrived,
  planRoot,
  building,
  applyBusy,
  uninstallBusy,
  onChoose,
  onOpenFolder,
  onUninstall,
}: {
  item: ToolInstallationView;
  arrived: boolean;
  planRoot: string | null;
  building: boolean;
  applyBusy: boolean;
  uninstallBusy: boolean;
  onChoose: () => void;
  onOpenFolder: () => void;
  onUninstall: () => void;
}) {
  const { t } = useI18n();
  const reviewing = planRoot === item.root;
  const settled = item.effective && item.selected;
  return (
    <li className="shell-panel-row shell-install-row !items-center !rounded-none first:!rounded-t-[11px] last:!rounded-b-[11px] !px-3 !py-2.5" data-effective={item.effective} data-arrived={arrived}>
      <span className="w-[4.75rem] shrink-0">
        <span className="shell-install-version font-semibold">{item.version}</span>
      </span>
      <span className="min-w-0 flex-1">
        <code className="block font-mono text-xs wrap-anywhere">{item.root}</code>
        <span className="block text-xs text-muted">
          <span>{item.vendor}</span> · <span>{t(`tools.installer.${item.installerKind}`)}</span>
        </span>
        {item.selected && !item.effective && (
          <span className="mt-1 block">
            <span className="shell-pill shell-pill-warn">{t("desktop_shell.selection")}</span>
          </span>
        )}
        {!item.available && (
          <span className="mt-1 block">
            <span className="shell-pill shell-pill-warn">{t("tools.unavailable")}</span>
          </span>
        )}
        {item.mismatchReason && <span className="mt-1 block text-xs text-muted">{mismatchReasonText(item.mismatchReason, t)}</span>}
      </span>
      {item.effective && (
        <span className="shell-in-use">
          <span aria-hidden className="shell-in-use-dot" />
          {t("desktop_shell.in_use")}
        </span>
      )}
      {!settled && (
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
          {reviewing ? t("desktop_shell.reviewing_plan") : t("desktop_shell.use")}
        </Button>
      )}
      {item.available && (
        <>
          <IconButton
            className="size-7"
            aria-label={t("desktop_shell.open_folder_of", { vendor: item.vendor, version: item.version })}
            title={t("tools.uninstall.open_folder")}
            icon="folder"
            onClick={onOpenFolder}
          />
          <IconButton className="size-7" aria-label={t("desktop_shell.uninstall_installation", { vendor: item.vendor, version: item.version })} title={t("tools.uninstall_button")} icon="trash" disabled={uninstallBusy} onClick={onUninstall} />
        </>
      )}
    </li>
  );
}
