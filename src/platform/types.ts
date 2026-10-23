export type TerminalKind = "windows_terminal" | "power_shell" | "cmd";

export interface LaunchOptions {
  demo: boolean;
  demoFixture: string | null;
}

export interface UpdateInfo {
  version: string;
  url: string;
}

export interface WhichcraftSettings {
  installStore: string;
  /** Earlier stores; their installations stay listed until empty. */
  previousInstallStores?: string[];
  /** False until the user confirms the install folder before the first install. */
  installStoreConfirmed?: boolean;
  scanRoots: string[];
  terminal: TerminalKind;
}
