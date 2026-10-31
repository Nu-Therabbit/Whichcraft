import { useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import type { TerminalKind, WhichcraftSettings } from "../../types";
import { Button } from "../ui/Button";

interface Props {
  settings: WhichcraftSettings;
  busy: boolean;
  onSave: (settings: WhichcraftSettings) => void;
}

const TERMINALS: TerminalKind[] = ["windows_terminal", "power_shell", "cmd"];

/** Scan folders (06), where Whichcraft installs tools (13) and which terminal it opens (09). */
export function ToolsSettings({ settings, busy, onSave }: Props) {
  const { t } = useI18n();
  const [newRoot, setNewRoot] = useState("");
  const [store, setStore] = useState(settings.installStore);

  const save = (patch: Partial<WhichcraftSettings>) => onSave({ ...settings, ...patch });
  const addRoot = () => {
    const root = newRoot.trim();
    if (!root || settings.scanRoots.includes(root)) return;
    save({ scanRoots: [...settings.scanRoots, root] });
    setNewRoot("");
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("tools.settings.scan_roots")}</h2>
        <p className="text-xs text-muted">{t("tools.settings.scan_roots_hint")}</p>
        <ul className="flex flex-col gap-1">
          {settings.scanRoots.map((root) => (
            <li key={root} className="flex items-center justify-between gap-2">
              <span className="font-mono wrap-anywhere">{root}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => save({ scanRoots: settings.scanRoots.filter((r) => r !== root) })}
              >
                {t("tools.settings.remove")}
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-field border border-rim rounded-control px-2 py-1 font-mono"
            aria-label={t("tools.settings.scan_root_input")}
            name="scan-root"
            autoComplete="off"
            spellCheck={false}
            placeholder="E:\Dev"
            value={newRoot}
            onChange={(e) => setNewRoot(e.target.value)}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !newRoot.trim()}
            onClick={addRoot}
          >
            {t("tools.settings.add")}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("tools.settings.install_store")}</h2>
        <p className="text-xs text-muted">{t("tools.settings.install_store_hint")}</p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-field border border-rim rounded-control px-2 py-1 font-mono"
            aria-label={t("tools.settings.install_store")}
            name="install-store"
            autoComplete="off"
            spellCheck={false}
            value={store}
            onChange={(e) => setStore(e.target.value)}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !store.trim() || store.trim() === settings.installStore}
            onClick={() => save({ installStore: store.trim(), installStoreConfirmed: true })}
          >
            {t("tools.settings.save")}
          </Button>
        </div>
        {(settings.previousInstallStores ?? []).length > 0 && (
          <p className="text-xs text-muted">
            {t("tools.settings.previous_stores")}{" "}
            <span className="font-mono">{(settings.previousInstallStores ?? []).join(", ")}</span>
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("tools.settings.terminal")}</h2>
        <select
          className="bg-field border border-rim rounded-control px-2 py-1 w-fit"
          aria-label={t("tools.settings.terminal")}
          value={settings.terminal}
          disabled={busy}
          onChange={(e) => save({ terminal: e.target.value as TerminalKind })}
        >
          {TERMINALS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`tools.settings.terminal_kind.${kind}`)}
            </option>
          ))}
        </select>
      </section>
    </div>
  );
}
