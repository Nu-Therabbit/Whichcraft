import { invoke } from "@tauri-apps/api/core";
import type { EnvarlyApi } from "../contracts";
import type { LaunchOptions } from "../platform/types";
import { inferEnvValueKind } from "../lib/envValueKind";
import type {
  EnvSnapshot,
  EnvVar,
  FullPathStatus,
  SnapshotMeta,
  SnapshotValue,
  VarScope,
} from "../types";
import bundledFixture from "./envarly-demo.json";

interface DemoFixture {
  elevated: boolean;
  installDir: string;
  pathStatus: {
    userHasEntry: boolean;
    systemHasEntry: boolean;
  };
  pathExists: Record<string, boolean>;
  baseline?: EnvSnapshot;
  current: EnvSnapshot;
  snapshots: SnapshotMeta[];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function inferListSeparator(name: string, value: string): ";" | "," | null {
  const upper = name.toUpperCase();
  if (upper === "PATH" || upper === "PATHEXT") return ";";
  if (upper === "NO_PROXY" || upper === "NOPROXY") return ",";
  if (value.includes(";") && value.split(";").some((part) => part.includes("\\"))) return ";";
  return null;
}

function snapshotToVars(snapshot: EnvSnapshot): EnvVar[] {
  return (["User", "System"] as const).flatMap((scope) => {
    const entries = scope === "User" ? snapshot.user : snapshot.system;
    return Object.entries(entries).map(([name, entry]) => ({
      name,
      value: entry.value,
      scope,
      valueKind: entry.kind ?? inferEnvValueKind(entry.value),
      listSeparator: inferListSeparator(name, entry.value),
    }));
  });
}

function scopedRecord(snapshot: EnvSnapshot, scope: VarScope) {
  return scope === "User" ? snapshot.user : snapshot.system;
}

function normalizeValues(values: Record<string, string | SnapshotValue> = {}) {
  return Object.fromEntries(
    Object.entries(values).map(([name, entry]) => [
      name,
      typeof entry === "string" ? { value: entry, kind: null } : entry,
    ]),
  );
}

function normalizeSnapshot(snapshot: {
  user?: Record<string, string | SnapshotValue>;
  system?: Record<string, string | SnapshotValue>;
}): EnvSnapshot {
  return {
    user: normalizeValues(snapshot.user),
    system: normalizeValues(snapshot.system),
    otherUser: null,
  };
}

export async function loadDemoFixture(options: LaunchOptions): Promise<DemoFixture> {
  const load = (raw: unknown) => {
    const fixture = clone(raw) as Omit<DemoFixture, "current" | "baseline" | "snapshots"> & {
      current: Parameters<typeof normalizeSnapshot>[0];
      baseline?: Parameters<typeof normalizeSnapshot>[0];
      snapshots: Array<
        Omit<SnapshotMeta, "snapshot" | "version"> & {
          version?: number;
          snapshot: Parameters<typeof normalizeSnapshot>[0];
        }
      >;
    };
    return {
      ...fixture,
      current: normalizeSnapshot(fixture.current),
      baseline: fixture.baseline ? normalizeSnapshot(fixture.baseline) : undefined,
      snapshots: fixture.snapshots.map((snapshot) => ({
        ...snapshot,
        version: snapshot.version ?? 1,
        snapshot: normalizeSnapshot(snapshot.snapshot),
      })),
    };
  };
  if (!options.demoFixture) return load(bundledFixture);
  const content = await invoke<string>("read_demo_fixture", { path: options.demoFixture });
  return load(JSON.parse(content));
}

export function createDemoApi(
  options: LaunchOptions,
  fixture: DemoFixture,
  fallbackApi: EnvarlyApi,
): EnvarlyApi {
  const current = clone(fixture.current);
  let snapshots = clone(fixture.snapshots);
  let pendingBaseline = fixture.baseline ? clone(fixture.baseline) : null;

  const snapshot = () => clone(current);

  return {
    getLaunchOptions: async () => options,
    getEnvVars: async () => snapshotToVars(current),
    getUnsupportedEnvValues: async () => [],
    setEnvVar: async (name, value, valueKind, scope) => {
      scopedRecord(current, scope)[name] = { value, kind: valueKind };
    },
    deleteEnvVar: async (name, scope) => {
      delete scopedRecord(current, scope)[name];
    },
    applyEnvChanges: async (changes) => {
      for (const change of changes) {
        if (change.changeType === "delete") {
          delete scopedRecord(current, change.scope)[change.name];
        } else {
          scopedRecord(current, change.scope)[change.name] = {
            value: change.value,
            kind: change.valueKind,
          };
        }
      }
    },
    createSnapshot: async (label) => {
      const created: SnapshotMeta = {
        version: 2,
        id: `demo-${Date.now()}`,
        createdAt: new Date().toISOString(),
        label,
        snapshot: snapshot(),
      };
      snapshots = [created, ...snapshots];
      return clone(created);
    },
    listSnapshots: async () => clone(snapshots),
    renameSnapshot: async (id, label) => {
      const snapshotToRename = snapshots.find((snap) => snap.id === id);
      if (!snapshotToRename) throw new Error(`Snapshot not found: ${id}`);
      const nextLabel = label.trim();
      if (!nextLabel) throw new Error("Snapshot name cannot be empty");
      snapshotToRename.label = nextLabel;
      return clone(snapshotToRename);
    },
    deleteSnapshot: async (id) => {
      snapshots = snapshots.filter((snap) => snap.id !== id);
    },
    validatePaths: async (paths) =>
      paths.map((path) => {
        const normalized = path.trim();
        if (normalized in fixture.pathExists) return fixture.pathExists[normalized];
        return (
          !normalized.toLowerCase().includes("missing") &&
          !normalized.toLowerCase().includes("oldtools")
        );
      }),
    getRegistrySnapshot: async () => {
      if (pendingBaseline) {
        const baseline = pendingBaseline;
        pendingBaseline = null;
        return baseline;
      }
      return snapshot();
    },
    isElevated: async () => fixture.elevated,
    restartAsAdmin: async () => undefined,
    exportVars: async (_scope, format) =>
      `C:\\Users\\Demo\\Downloads\\envarly-demo.${format === "reg" ? "reg" : "json"}`,
    exportCustomVars: async (_vars, format) =>
      `C:\\Users\\Demo\\Downloads\\envarly-demo-custom.${format === "reg" ? "reg" : "json"}`,
    parseImport: async (content, format) => {
      if (format !== "json") {
        return fallbackApi.parseImport(content, format);
      }
      return normalizeSnapshot(JSON.parse(content));
    },
    getPathStatus: async () => ({
      installDir: fixture.installDir,
      userHasEntry: fixture.pathStatus.userHasEntry,
      systemHasEntry: fixture.pathStatus.systemHasEntry,
      otherUserHasEntry: null, // demo mode has no other-user accounts
    }),
    getPathProposal: async (scope) => {
      const path = scopedRecord(current, scope).Path?.value ?? "";
      const entries = path.split(";").filter(Boolean);
      if (entries.some((entry) => entry.toLowerCase() === fixture.installDir.toLowerCase())) {
        return null;
      }
      return [fixture.installDir, ...entries].join(";");
    },
    checkCommand: async (input) => {
      const unquoted = input.trim().replace(/^"(.*)"$/, "$1");
      const lastSep = Math.max(unquoted.lastIndexOf("\\"), unquoted.lastIndexOf("/"));
      const basename = lastSep >= 0 ? unquoted.slice(lastSep + 1) : unquoted;
      const fullDir = lastSep >= 0 ? unquoted.slice(0, lastSep) : null;
      const hadExtension = basename.includes(".");
      const nameOnly = (hadExtension ? basename.replace(/\.[^.]+$/, "") : basename).toLowerCase();

      const dirsWithSource: Array<{ dir: string; source: "User" | "System" }> = [
        ...(current.system.Path?.value.split(";").filter(Boolean) ?? []).map((dir) => ({
          dir,
          source: "System" as const,
        })),
        ...(current.user.Path?.value.split(";").filter(Boolean) ?? []).map((dir) => ({
          dir,
          source: "User" as const,
        })),
      ];

      // Demo heuristic (no real filesystem access): a directory "contains" the
      // command if its name hints at the tool, e.g. a "nodejs" dir matches "node".
      const hits = dirsWithSource
        .filter(({ dir }) => nameOnly && dir.toLowerCase().includes(nameOnly))
        .map(({ dir, source }) => ({
          directory: dir,
          matchedFile: hadExtension ? basename : `${basename}.EXE`,
          source,
        }));

      let fullPathStatus: FullPathStatus | null = null;
      if (fullDir) {
        const normalize = (d: string) => d.replace(/[\\/]+$/, "").toLowerCase();
        const idx = hits.findIndex((h) => normalize(h.directory) === normalize(fullDir));
        fullPathStatus =
          idx === 0
            ? { status: "active" }
            : idx > 0
              ? { status: "shadowed", shadowedBy: hits[0] }
              : { status: "notOnEffectivePath" };
      }

      return {
        input: unquoted,
        queriedName: hadExtension ? basename : `${basename}.EXE`,
        hadExtension,
        hits,
        fullPathStatus,
      };
    },
    checkForUpdate: async () => null,
    openUrl: (url) => fallbackApi.openUrl(url),
    // Demo mode has no other-user accounts to switch between.
    listLocalAccounts: async () => [],
    selectAccount: async () => null,
    getSelectedAccount: async () => null,
    onApplyProgress: async () => () => {},
    listToolInstallations: async () => [],
    planToolApply: async () => {
      throw new Error("demo");
    },
    applyToolPlan: async () => ({ planId: "", stale: false, needsElevation: false }),
    applyToolPlanWithUac: async () => ({ planId: "", stale: false, needsElevation: false }),
    undoLastWhichcraftApply: async () => ({ conflicts: [], restored: 0 }),
    listRemoteVersions: async () => [],
    getMiseStatus: async () => ({
      version: "2026.10.17",
      present: false,
      downloadBytes: 81_189_867,
      oldVersions: [],
      fetching: false,
    }),
    downloadSize: async () => ({ downloadBytes: null, diskBytes: null }),
    installManaged: async () => {
      throw new Error("Installing is unavailable in demo mode");
    },
    planUninstall: async () => {
      throw new Error("Uninstalling is unavailable in demo mode");
    },
    uninstall: async () => {
      throw new Error("Uninstalling is unavailable in demo mode");
    },
    openFolder: async () => {},
    unfinishedUninstalls: async () => [],
    dismissUnfinishedUninstall: async () => {},
    updateCandidates: async () => [],
    updateInstallation: async () => {
      throw new Error("Updating is unavailable in demo mode");
    },
    prepareMise: async () => false,
    planPathCleanup: async () => {
      throw new Error("PATH cleanup is unavailable in demo mode");
    },
    listProfiles: async () => [],
    saveProfiles: async () => {},
    profileStatus: async (profile) => ({ profile, matchesEffective: false, unavailable: [] }),
    planProfile: async () => {
      throw new Error("Profiles are unavailable in demo mode");
    },
    profileMissing: async () => [],
    installMissing: async () => {
      throw new Error("Installing is unavailable in demo mode");
    },
    repointProfiles: async () => [],
    profilesUsing: async () => [],
    openTerminal: async () => {
      throw new Error("Opening a terminal is unavailable in demo mode");
    },
    shellCheck: async (tool) => ({
      tool,
      shell: "windows_terminal",
      effectivePath: null,
      shellPath: null,
      matches: true,
    }),
    getPythonLauncherInfo: async () => ({ launcherLines: [], launcherInstalled: false, storeStub: null, note: "" }),
    getAndroidInventory: async () => ({
      sdkRoot: null,
      rootSource: null,
      platforms: [],
      buildTools: [],
      ndk: [],
      platformTools: null,
      emulator: null,
      cmake: [],
    }),
    getMsvcInventory: async () => ({ instances: [], windowsSdks: [] }),
    getWhichcraftSettings: async () => ({
      installStore: "C:\\Users\\demo\\AppData\\Local\\Whichcraft\\installs",
      scanRoots: [],
      terminal: "windows_terminal",
    }),
    saveWhichcraftSettings: async () => {},
    getRecoveryStatus: async () => null,
    resumeApply: async () => {},
    rollBackApply: async () => ({ conflicts: [], restored: 0 }),
  };
}
