import { useEffect, useState } from "react";
import type { PlatformApi } from "../platform/api";
import type { UpdateInfo } from "../platform/types";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = "whichcraft.lastUpdateCheck";

export function useUpdateCheck(platform: Pick<PlatformApi, "checkForUpdate">) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    const lastChecked = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
    if (Date.now() - lastChecked < CHECK_INTERVAL_MS) return;

    void platform
      .checkForUpdate()
      .then((info) => {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        if (info) setUpdateInfo(info);
      })
      .catch(() => {});
  }, [platform]);

  return updateInfo;
}
