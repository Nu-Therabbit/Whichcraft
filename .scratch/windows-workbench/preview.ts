// Validation entry only: production components, isolated in-memory data, no native writes.
import { configureProductionServices } from "../../src/composition/createProductionServices";
import { splitWhichcraftApi } from "../../src/composition/appServices";
import { createDemoApi, loadDemoFixture } from "../../src/demo/createDemoApi";
import type { WhichcraftApi } from "../../src/contracts";
import type { ToolInstallationView, ToolKind } from "../../src/features/tools/types";

const params = new URLSearchParams(location.search);
localStorage.setItem("whichcraft-theme", params.get("theme") === "dark" ? "dark" : "light");
localStorage.setItem("whichcraft-language", "en");
const options = { demo: true, demoFixture: null };
const fallback = new Proxy({} as WhichcraftApi, { get: () => async () => null });
const api = createDemoApi(options, await loadDemoFixture(options), fallback);
const installation = (tool: ToolKind, vendor: string, version: string, root: string, extra = {}): ToolInstallationView => ({
  tool, vendor, version, root, managed: false, effective: true, selected: true,
  available: true, installerKind: "folder_only", mismatchReason: null, ...extra,
});
const inventory: Record<ToolKind, ToolInstallationView[]> = {
  java: [installation("java", "Eclipse Adoptium", "21.0.8", "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.8", { selected: false }), installation("java", "Eclipse Adoptium", "17.0.16", "C:\\Developer\\Java\\jdk-17.0.16", { effective: false })],
  node: [installation("node", "Node.js", "22.18.0", "C:\\Developer\\Whichcraft\\installs\\node\\22.18.0", { managed: true, installerKind: "managed_by_whichcraft" }), installation("node", "Node.js", "20.19.4", "C:\\Program Files\\nodejs", { effective: false, selected: false })],
  python: [installation("python", "Python Software Foundation", "3.13.7", "C:\\Users\\developer\\AppData\\Local\\Programs\\Python\\Python313")],
  go: [installation("go", "Go", "1.25.0", "C:\\Program Files\\Go")],
  flutter: [],
  git: [installation("git", "Git for Windows", "2.51.0", "C:\\Program Files\\Git")],
};
api.listToolInstallations = async (tool) => {
  if (params.get("state") === "loading") await new Promise((r) => setTimeout(r, 15000));
  if (params.get("state") === "error" && tool === "java") throw new Error("Java scan failed. Rescan to try again.");
  return params.get("state") === "empty" ? [] : structuredClone(inventory[tool]);
};
api.getWhichcraftSettings = async () => ({ installStore: "C:\\Developer\\Whichcraft\\installs", scanRoots: ["C:\\Developer"], terminal: "windows_terminal", installStoreConfirmed: true });
api.getAndroidInventory = async () => ({ sdkRoot: "C:\\Users\\developer\\AppData\\Local\\Android\\Sdk", rootSource: "ANDROID_HOME", platforms: ["android-35", "android-36"], buildTools: ["35.0.0"], ndk: [], platformTools: "36.0.0", emulator: "36.1.9", cmake: [] });
api.getMsvcInventory = async () => ({ instances: [{ displayName: "Visual Studio Community 2022", version: "17.14", path: "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community", msvcToolsets: ["14.44.35207"] }], windowsSdks: ["10.0.26100.0"] });
api.getPythonLauncherInfo = async () => ({ launcherLines: [{ tag: "3.13", path: inventory.python[0].root + "\\python.exe", isDefault: true }], launcherInstalled: true, storeStub: null, note: "Python Launcher resolves independently of PATH." });
api.planToolApply = async (tool, root) => ({ planId: "visual-plan", tool, selected: inventory[tool].find((i) => i.root === root)!, requiresUac: false, effectiveAfterUserOnly: true, userDiffs: [{ name: tool === "java" ? "JAVA_HOME" : "PATH", scope: "User", before: inventory[tool][0].root, after: root, valueKind: "String" }], systemDiffs: [], warnings: [], limitationNotice: "Already open programs keep their environment. Open a new terminal to use this installation." });
api.shellCheck = async (tool) => ({ tool, shell: "windows_terminal", effectivePath: inventory[tool][0]?.root ?? null, shellPath: inventory[tool][0]?.root ?? null, matches: true });
const pin = (tool: ToolKind, vendor: string, version: string) => ({ tool, vendor, version });
const demoProfiles = [
  { id: "android", name: "Android work", tools: [pin("java", "Eclipse Adoptium", "17.0.16"), pin("node", "Node.js", "20.19.4")] },
  { id: "web", name: "Web apps", tools: [pin("node", "Node.js", "22.18.0"), pin("python", "Python Software Foundation", "3.13.7")] },
  { id: "client", name: "Old client", tools: [pin("java", "Eclipse Adoptium", "11.0.28"), pin("go", "Go", "1.25.0")] },
];
api.listProfiles = async () => structuredClone(demoProfiles);
api.profileStatus = async (profile) => ({ profile, matchesEffective: profile.id === "web", unavailable: profile.id === "client" ? [profile.tools[0]] : [] });
api.planUninstall = async (tool, root) => ({ installation: inventory[tool].find((i) => i.root === root)!, method: { kind: "recycleFolder" }, usage: { processes: [], folderLocked: false }, needsReplacement: false, replacements: [], affectedProfiles: [], gradleHint: false, noConfirmation: false });
configureProductionServices(splitWhichcraftApi(api));
await import("../../src/main");
