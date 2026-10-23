import { useMemo, useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import type { MiseStatus, RemoteVersion, ToolKind, WhichcraftSettings } from "../../types";
import { Button } from "../ui/Button";

interface Props {
  tool: ToolKind;
  versions: RemoteVersion[];
  loading: boolean;
  busy: boolean;
  miseStatus: MiseStatus | null;
  settings: WhichcraftSettings;
  chosen: { version: string; downloadBytes: number | null; diskBytes?: number | null } | null;
  onChoose: (version: string) => void;
  onConfirmStore: (store: string) => void;
  onInstall: () => void;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

const SHOWN = 40;

/** Pick a version, see its size, confirm the install folder once (I-5), then install. */
export function InstallSection({
  tool,
  versions,
  loading,
  busy,
  miseStatus,
  settings,
  chosen,
  onChoose,
  onConfirmStore,
  onInstall,
}: Props) {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const [store, setStore] = useState(settings.installStore);
  const newestFirst = useMemo(() => {
    const matching = versions.filter((v) => v.version.includes(filter.trim()));
    return [...matching].reverse().slice(0, SHOWN);
  }, [versions, filter]);
  const storeConfirmed = settings.installStoreConfirmed ?? false;

  return (
    <section className="border border-rim rounded-md p-4 flex flex-col gap-3 text-sm">
      <h3 className="font-semibold">{t("tools.install.title", { tool: t(`tools.kind.${tool}`) })}</h3>
      <input
        className="bg-surface border border-rim rounded-md px-2 py-1 font-mono"
        aria-label={t("tools.install.filter")}
        placeholder={t("tools.install.filter")}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {loading ? (
        <p className="text-muted">{t("app.loading")}</p>
      ) : (
        <ul className="max-h-40 overflow-auto border border-rim rounded-md divide-y divide-rim">
          {newestFirst.map((v) => (
            <li key={v.version}>
              <button
                type="button"
                className={`w-full text-left px-3 py-1 font-mono hover:bg-surface/60 ${chosen?.version === v.version ? "bg-surface" : ""}`}
                onClick={() => onChoose(v.version)}
              >
                {v.version}
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen && (
        <div className="flex flex-col gap-2">
          <p>
            {t("tools.install.chosen", { version: chosen.version })}{" "}
            {chosen.downloadBytes != null
              ? t("tools.install.size", { size: formatBytes(chosen.downloadBytes) })
              : t("tools.install.size_unknown")}
            {chosen.diskBytes != null && ` ${t("tools.install.disk", { size: formatBytes(chosen.diskBytes) })}`}
          </p>
          {miseStatus && !miseStatus.present && (
            <p className="text-xs text-warning">
              {t("tools.install.mise_first", { version: miseStatus.version, size: formatBytes(miseStatus.downloadBytes) })}
            </p>
          )}
          {!storeConfirmed ? (
            <div className="flex flex-col gap-2 border border-warning/40 rounded-md p-3">
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
          ) : (
            <p className="text-xs text-muted">{t("tools.install.into", { store: settings.installStore })}</p>
          )}
          {miseStatus?.fetching && (
            <p className="text-xs text-warning">{t("tools.install.wait_for_mise", { version: miseStatus.version })}</p>
          )}
          <Button variant="primary" disabled={busy || !storeConfirmed || !!miseStatus?.fetching} onClick={onInstall}>
            {busy ? t("tools.install.installing") : t("tools.install.install")}
          </Button>
        </div>
      )}
    </section>
  );
}
