import { createContext, useContext } from "react";
import type { PlatformApi } from "./api";

const PlatformApiContext = createContext<PlatformApi | null>(null);

/** Native OS capabilities (folder picker, browser, elevation) for presentation components. */
export function PlatformApiProvider({
  platform,
  children,
}: {
  platform: PlatformApi;
  children: React.ReactNode;
}) {
  return <PlatformApiContext.Provider value={platform}>{children}</PlatformApiContext.Provider>;
}

export function usePlatformApi(): PlatformApi {
  const platform = useContext(PlatformApiContext);
  if (!platform) {
    throw new Error("usePlatformApi requires PlatformApiProvider or AppServicesProvider");
  }
  return platform;
}
