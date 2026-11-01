import { useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import { Button } from "../ui/Button";

interface Props {
  installStore: string;
  busy: boolean;
  onConfirmStore: (store: string) => void;
}

/** Asks once where installed tools go, before the first install, update or install-missing (I-5). */
export function StoreConfirm({ installStore, busy, onConfirmStore }: Props) {
  const { t } = useI18n();
  const [store, setStore] = useState(installStore);
  return (
    <div className="flex flex-col gap-2 border border-warn/40 rounded-md p-3">
      <p className="text-xs">{t("tools.install.confirm_store")}</p>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-surface border border-rim rounded-md px-2 py-1 font-mono"
          aria-label={t("tools.settings.install_store")}
          value={store}
          onChange={(e) => setStore(e.target.value)}
        />
        <Button variant="secondary" size="sm" disabled={busy || !store.trim()} onClick={() => onConfirmStore(store.trim())}>
          {t("tools.install.use_folder")}
        </Button>
      </div>
    </div>
  );
}
