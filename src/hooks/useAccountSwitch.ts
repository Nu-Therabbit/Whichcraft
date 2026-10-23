import { useCallback, useEffect, useState } from "react";
import type { EnvironmentApi } from "../features/environment/api";
import type { LocalAccount } from "../types";

interface Params {
  elevated: boolean;
  /** Switching accounts while changes are staged would leave them pointing at
   * a hive that's no longer active, so callers should block the switch (e.g.
   * disable the picker) while this is true rather than silently discarding. */
  hasStagedChanges: boolean;
  /** Re-fetch vars, diff baseline, and PATH status for the new context. */
  refresh: () => Promise<void>;
}

export function useAccountSwitch(
  environment: EnvironmentApi,
  { elevated, hasStagedChanges, refresh }: Params,
) {
  const [accounts, setAccounts] = useState<LocalAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<LocalAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!elevated) {
      setAccounts([]);
      return;
    }
    let cancelled = false;
    environment
      .listLocalAccounts()
      .then((list) => {
        if (!cancelled) setAccounts(list);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [elevated, environment]);

  const handleSelectAccount = useCallback(
    async (sid: string | null) => {
      if (hasStagedChanges) return;
      setError(null);
      try {
        const account = await environment.selectAccount(sid);
        setSelectedAccount(account);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [environment, hasStagedChanges, refresh],
  );

  return { accounts, selectedAccount, handleSelectAccount, accountSwitchError: error };
}
