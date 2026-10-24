import { useEffect } from "react";
import { ProfilesSection } from "../../components/ToolsPanel/ProfilesSection";
import { useI18n } from "../../hooks/useI18n";
import { ShellProfilePlanPanel } from "./ShellProfilePlanPanel";
import { useTools } from "../tools/ToolsContext";

/** Tool profiles workspace in the desktop shell (saved pins, apply, install-missing). */
export function ShellProfilesWorkspace() {
  const { t } = useI18n();
  const { state, dispatch } = useTools();
  const { profiles, settings, plan } = state;
  const applyBusy = plan.applying || plan.building;

  useEffect(() => {
    dispatch({ type: "loadProfiles" });
  }, [dispatch]);

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

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold">{t("desktop_shell.page_profiles")}</h2>
        <p className="text-xs text-dim">{t("desktop_shell.profiles_intro")}</p>
      </div>
      <ProfilesSection
        profiles={profiles.list}
        current={profiles.current}
        missing={profiles.missing}
        busy={profiles.busy || applyBusy}
        onCreate={(name, tools) => dispatch({ type: "createProfile", name, tools })}
        onDelete={(id) => dispatch({ type: "deleteProfile", id })}
        onApply={(profile) => dispatch({ type: "planProfile", profile })}
        onCheckMissing={(profile) => dispatch({ type: "checkMissing", profile })}
        onInstallMissing={(profile) => dispatch({ type: "installMissing", profile })}
        store={storeGate}
      />
      <ShellProfilePlanPanel state={state} dispatch={dispatch} />
    </div>
  );
}
