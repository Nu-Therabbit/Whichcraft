import { installStoreGate } from "./installStoreGate";
import { useEffect } from "react";
import { ProfilesSection } from "../../components/ToolsPanel/ProfilesSection";
import { useI18n } from "../../hooks/useI18n";
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

  const storeGate = installStoreGate(settings, dispatch);
  return (
    <div className="shell-scroll">
      <p className="mb-3 mt-3 text-muted">{t("desktop_shell.profiles_intro")}</p>
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
    </div>
  );
}
