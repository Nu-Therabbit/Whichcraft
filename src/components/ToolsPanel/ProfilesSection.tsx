import { useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import type { MissingPin, ProfileMatchStatus, ProfileToolPin, ToolProfile } from "../../types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { ToolLogo } from "../ui/ToolLogo";
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
  const [deleting, setDeleting] = useState<ToolProfile | null>(null);
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
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-3">
          {profiles.map(({ profile, matchesEffective, unavailable }) => (
            <li key={profile.id} className="shell-panel p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{profile.name}</span>
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
                  !matchesEffective && (
                    <Button variant="secondary" size="xs" disabled={busy} onClick={() => onApply(profile)}>
                      {t("tools.profiles.apply")}
                    </Button>
                  )
                )}
                <Button variant="ghost" size="xs" disabled={busy} onClick={() => setDeleting(profile)}>
                  {t("tools.profiles.delete")}
                </Button>
              </div>
              <ul className="flex flex-col gap-1 text-xs text-muted">
                {profile.tools.map((pin) => (
                  <li key={pinKey(pin)} className={`flex items-center gap-2 ${unavailable.some((u) => pinKey(u) === pinKey(pin)) ? "text-warn" : ""}`}>
                    <ToolLogo tool={pin.tool} tile={22} size={16} />
                    <span className="min-w-0 wrap-anywhere">
                      <PinLabel pin={pin} />
                    </span>
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

      <div className="shell-panel mt-3 p-3 flex flex-col gap-2">
        <h3 className="font-semibold">{t("tools.profiles.new_title")}</h3>
        <p className="text-xs text-muted">{t("tools.profiles.new_hint")}</p>
        {current.map((pin) => (
          <label key={pinKey(pin)} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={!excluded.has(pinKey(pin))} onChange={() => toggle(pinKey(pin))} />
            <PinLabel pin={pin} />
          </label>
        ))}
        <div className="flex gap-2">
          <input
            className="flex-1 bg-field border border-rim-subtle rounded-control px-2.5 h-8"
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

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} ariaLabel={t("tools.profiles.delete_title", { name: deleting?.name ?? "" })} size="md" flex>
        {deleting && (
          <>
            <div className="p-5">
              <h2 className="shell-dialog-title mb-1">{t("tools.profiles.delete_title", { name: deleting.name })}</h2>
              <p className="text-muted">{t("tools.profiles.delete_body")}</p>
            </div>
            <div className="shell-dialog-footer">
              <Button
                variant="danger"
                onClick={() => {
                  onDelete(deleting.id);
                  setDeleting(null);
                }}
              >
                {t("tools.profiles.delete")}
              </Button>
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                {t("tools.profiles.delete_cancel")}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}
