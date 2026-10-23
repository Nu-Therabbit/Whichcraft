import { useI18n } from "../../hooks/useI18n";
import type { LocalAccount } from "../../types";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";

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
    </div>
  );
}
