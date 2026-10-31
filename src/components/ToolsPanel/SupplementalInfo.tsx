import { useI18n } from "../../hooks/useI18n";
import type { AndroidInventory, MsvcInventory, PythonSupplementalView } from "../../types";

function Row({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="shell-sdk-row">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono wrap-anywhere">{values.length ? values.join(", ") : "—"}</dd>
    </div>
  );
}

/** What `py` and the Store alias would run, shown apart from the PATH `python` (E-5). */
export function PythonLauncherInfo({ info }: { info: PythonSupplementalView }) {
  const { t } = useI18n();
  return (
    <section className="shell-python-info border border-rim-subtle rounded-md p-4 flex flex-col gap-2 text-sm">
      <h3 className="font-semibold">{t("tools.python.title")}</h3>
      <p className="text-xs text-muted">{info.note}</p>
      {!info.launcherInstalled ? (
        <p className="text-xs text-muted">{t("tools.python.no_launcher")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {info.launcherLines.map((line) => (
            <li key={line.tag} className="font-mono text-xs wrap-anywhere">
              py -V:{line.tag} {line.isDefault ? `(${t("tools.python.default")})` : ""} →{" "}
              {line.path}
            </li>
          ))}
        </ul>
      )}
      {info.storeStub && (
        <p className="text-xs text-warn break-words">
          {t("tools.python.store_stub", { path: info.storeStub })}
        </p>
      )}
    </section>
  );
}

/** Android SDK, MSVC and Windows SDK: listed only, never selected or installed (D-7). */
export function SdkInventory({
  android,
  msvc,
}: {
  android: AndroidInventory | null;
  msvc: MsvcInventory | null;
}) {
  const { t } = useI18n();
  return (
    <div className="shell-sdk-inventory text-sm">
      <p className="text-xs text-muted">{t("tools.sdks.read_only")}</p>
      <section className="border border-rim-subtle rounded-md p-4 flex flex-col gap-2">
        <h3 className="font-semibold">{t("tools.sdks.android")}</h3>
        {!android?.sdkRoot ? (
          <p className="text-xs text-muted">{t("tools.sdks.android_missing")}</p>
        ) : (
          <dl className="flex flex-col gap-1">
            <Row
              label={t("tools.sdks.sdk_root")}
              values={[`${android.sdkRoot} (${android.rootSource})`]}
            />
            <Row label={t("tools.sdks.platforms")} values={android.platforms} />
            <Row label={t("tools.sdks.build_tools")} values={android.buildTools} />
            <Row label={t("tools.sdks.ndk")} values={android.ndk} />
            <Row
              label={t("tools.sdks.platform_tools")}
              values={android.platformTools ? [android.platformTools] : []}
            />
            <Row
              label={t("tools.sdks.emulator")}
              values={android.emulator ? [android.emulator] : []}
            />
            <Row label={t("tools.sdks.cmake")} values={android.cmake} />
          </dl>
        )}
      </section>
      <section className="border border-rim-subtle rounded-md p-4 flex flex-col gap-2">
        <h3 className="font-semibold">{t("tools.sdks.msvc")}</h3>
        <dl className="flex flex-col gap-1">
          {(msvc?.instances ?? []).map((vs) => (
            <Row key={vs.path} label={`${vs.displayName} ${vs.version}`} values={vs.msvcToolsets} />
          ))}
          <Row label={t("tools.sdks.windows_sdk")} values={msvc?.windowsSdks ?? []} />
        </dl>
      </section>
    </div>
  );
}
