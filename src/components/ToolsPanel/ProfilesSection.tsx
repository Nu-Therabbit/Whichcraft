import { useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import type { MissingPin, ProfileMatchStatus, ProfileToolPin, ToolProfile } from "../../types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { formatBytes } from "./InstallSection";
import { StoreConfirm } from "./StoreConfirm";

interface Props {
  profiles: ProfileMatchStatus[];
  /** The effective installation of each tool, offered when creating a profile. */
  current: ProfileToolPin[];
  missing: { profileId: string; items: MissingPin[] } | null;
  busy: boolean;
  onCreate: (name: string, tools: ProfileToolPin[]) => void;
  onDelete: (id: string) => void;
  onApply: (profile: ToolProfile) => void;
  onCheckMissing: (profile: ToolProfile) => void;
  onInstallMissing: (profile: ToolProfile) => void;
  /** Where installs go; until it is confirmed nothing is downloaded (I-5). */
  store: { confirmed: boolean; installStore: string; onConfirm: (store: string) => void };
}

const pinKey = (p: ProfileToolPin) => `${p.tool}|${p.vendor}|${p.version}`;

function PinLabel({ pin }: { pin: ProfileToolPin }) {
  const { t } = useI18n();
  return (
    <>
      {t(`tools.kind.${pin.tool}`)} {pin.vendor} {pin.version}
    </>
  );
}

function MissingList({
  items,
  busy,
  onInstall,
  store,
}: {
  items: MissingPin[];
  busy: boolean;
  onInstall: () => void;
  store: Props["store"];
}) {
  const { t } = useI18n();
  const installable = items.every((m) => m.installVersion);
  const knownBytes = items.reduce((sum, m) => sum + (m.downloadBytes ?? 0), 0);
  const allSizesKnown = items.every((m) => m.downloadBytes != null);
  return (
    <div className="flex flex-col gap-2 border border-warn/40 rounded-md p-3">
      <ul className="text-xs flex flex-col gap-1">
        {items.map((m) => (
          <li key={pinKey(m.pin)}>
            <PinLabel pin={m.pin} />
            {" — "}
            {m.installVersion
              ? t("tools.profiles.can_install", {
                  version: m.installVersion,
                  size: m.downloadBytes != null ? formatBytes(m.downloadBytes) : t("tools.profiles.size_unknown"),
                })
              : t("tools.profiles.cannot_install")}
          </li>
        ))}
      </ul>
      {installable && !store.confirmed && (
        <StoreConfirm installStore={store.installStore} busy={busy} onConfirmStore={store.onConfirm} />
      )}
      {installable ? (
        <Button variant="primary" size="sm" disabled={busy || !store.confirmed} onClick={onInstall}>
          {allSizesKnown
            ? t("tools.profiles.install_missing_sized", { size: formatBytes(knownBytes) })
            : t("tools.profiles.install_missing")}
        </Button>
      ) : (
        <p className="text-xs text-muted">{t("tools.profiles.fix_by_hand")}</p>
      )}
    </div>
  );
}

/** Named sets of tools; each shows whether it matches what is effective now (F-6). */
export function ProfilesSection({
  profiles,
  current,
  missing,
  busy,
  onCreate,
  onDelete,
  onApply,
  onCheckMissing,
  onInstallMissing,
  store,
}: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const chosen = current.filter((p) => !excluded.has(pinKey(p)));

  const toggle = (key: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="flex flex-col gap-3 text-sm">
      {profiles.length === 0 ? (
        <p className="text-muted">{t("tools.profiles.none")}</p>
      ) : (
        <ul className="border border-rim rounded-md divide-y divide-rim">
          {profiles.map(({ profile, matchesEffective, unavailable }) => (
            <li key={profile.id} className="p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{profile.name}</span>
                {unavailable.length > 0 ? (
                  <Badge variant="warn">{t("tools.profiles.unavailable", { count: unavailable.length })}</Badge>
                ) : matchesEffective ? (
                  <Badge variant="user">{t("tools.profiles.matches")}</Badge>
                ) : (
                  <Badge variant="muted">{t("tools.profiles.differs")}</Badge>
                )}
                <span className="flex-1" />
                {unavailable.length > 0 ? (
                  <Button variant="secondary" size="xs" disabled={busy} onClick={() => onCheckMissing(profile)}>
                    {t("tools.profiles.whats_missing")}
                  </Button>
                ) : (
                  <Button variant="secondary" size="xs" disabled={busy || matchesEffective} onClick={() => onApply(profile)}>
                    {t("tools.profiles.apply")}
                  </Button>
                )}
                <Button variant="ghost" size="xs" disabled={busy} onClick={() => onDelete(profile.id)}>
                  {t("tools.profiles.delete")}
                </Button>
              </div>
              <ul className="text-xs text-muted font-mono">
                {profile.tools.map((pin) => (
                  <li key={pinKey(pin)} className={unavailable.some((u) => pinKey(u) === pinKey(pin)) ? "text-warn" : ""}>
                    <PinLabel pin={pin} />
                  </li>
                ))}
              </ul>
              {missing?.profileId === profile.id && (
                <MissingList items={missing.items} busy={busy} onInstall={() => onInstallMissing(profile)} store={store} />
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border border-rim rounded-md p-3 flex flex-col gap-2">
        <h3 className="font-semibold">{t("tools.profiles.new_title")}</h3>
        <p className="text-xs text-muted">{t("tools.profiles.new_hint")}</p>
        {current.map((pin) => (
          <label key={pinKey(pin)} className="flex items-center gap-2 text-xs font-mono">
            <input type="checkbox" checked={!excluded.has(pinKey(pin))} onChange={() => toggle(pinKey(pin))} />
            <PinLabel pin={pin} />
          </label>
        ))}
        <div className="flex gap-2">
          <input
            className="flex-1 bg-surface border border-rim rounded-md px-2 py-1"
            aria-label={t("tools.profiles.name")}
            placeholder={t("tools.profiles.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !name.trim() || chosen.length === 0}
            onClick={() => {
              onCreate(name.trim(), chosen);
              setName("");
            }}
          >
            {t("tools.profiles.save")}
          </Button>
        </div>
      </div>
    </section>
  );
}
