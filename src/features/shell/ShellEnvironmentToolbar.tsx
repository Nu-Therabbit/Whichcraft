import { useI18n } from "../../hooks/useI18n";
import type { LocalAccount } from "../environment/types";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Select } from "../../components/ui/Select";
import { usePlatformApi } from "../../platform/platformApiContext";

interface Props {
  loading: boolean;
  stagedCount: number;
  diffCount: number;
  elevated: boolean;
  accounts: LocalAccount[];
  selectedAccount: LocalAccount | null;
  accountSwitchDisabled: boolean;
  onRefresh: () => void;
  onApplyStaged: () => void;
  onShowChanges: () => void;
  onSelectAccount: (sid: string | null) => void;
}

export function ShellEnvironmentToolbar({
  loading,
  stagedCount,
  diffCount,
  elevated,
  accounts,
  selectedAccount,
  accountSwitchDisabled,
  onRefresh,
  onApplyStaged,
  onShowChanges,
  onSelectAccount,
}: Props) {
  const { t } = useI18n();
  const platform = usePlatformApi();
  const selectableAccounts = accounts.filter((a) => a.hasProfile);
  const accountOptions = [
    { value: "", label: t("account_picker.my_variables") },
    ...selectableAccounts.map((a) => ({ value: a.sid, label: a.username })),
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-rim-subtle shrink-0"
      role="toolbar"
      aria-label={t("desktop_shell.environment_toolbar")}
    >
      <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
        {t("header.refresh")}
      </Button>
      {stagedCount > 0 && (
        <Button variant="primary" size="sm" onClick={onApplyStaged}>
          {t("header.staged_count", { count: stagedCount })}
        </Button>
      )}
      {diffCount > 0 && (
        <Button variant="secondary" size="sm" onClick={onShowChanges}>
          {t("header.external_changes", { count: diffCount })}
        </Button>
      )}
      {elevated && (
        <Select
          className="min-w-[10rem]"
          aria-label={t("account_picker.aria_label")}
          value={selectedAccount?.sid ?? ""}
          disabled={accountSwitchDisabled}
          options={accountOptions}
          onValueChange={(value) => onSelectAccount(value || null)}
        />
      )}
      <span className="ml-auto inline-flex items-center gap-2">
        {elevated ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Icon name="shield" size={14} />
            {t("header.administrator")}
          </span>
        ) : (
          // Restarting starts a new process, so staged edits must be applied or discarded first.
          <Button
            variant="warn"
            size="sm"
            icon="shield"
            onClick={() => void platform.restartAsAdmin()}
            disabled={stagedCount > 0}
            title={
              stagedCount > 0 ? t("desktop_shell.restart_admin_pending") : t("header.run_as_admin_title")
            }
          >
            {t("header.run_as_admin")}
          </Button>
        )}
      </span>
    </div>
  );
}
