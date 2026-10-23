import { useCallback, useEffect, useState } from "react";
import {
  readShellNavigation,
  shellNavigationHref,
  type ShellEnvironmentTab,
  type ShellNavigation,
  type ShellPage,
} from "../../lib/shellNavigation";

export function useShellNavigation() {
  const [nav, setNav] = useState<ShellNavigation>(() => readShellNavigation());

  useEffect(() => {
    const onPop = () => setNav(readShellNavigation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((patch: Partial<ShellNavigation>) => {
    const href = shellNavigationHref(patch);
    window.history.pushState(null, "", href);
    setNav(readShellNavigation());
  }, []);

  const goPage = useCallback((page: ShellPage) => navigate({ page }), [navigate]);
  const goEnvTab = useCallback(
    (envTab: ShellEnvironmentTab) => navigate({ page: "environment", envTab }),
    [navigate],
  );

  return { ...nav, navigate, goPage, goEnvTab };
}
