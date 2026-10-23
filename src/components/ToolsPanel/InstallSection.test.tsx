import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WhichcraftSettings } from "../../types";
import { formatBytes, InstallSection } from "./InstallSection";

const settings: WhichcraftSettings = {
  installStore: "C:\\Users\\me\\AppData\\Local\\Whichcraft\\installs",
  scanRoots: [],
  terminal: "windows_terminal",
  installStoreConfirmed: false,
};

const base = {
  tool: "node" as const,
  versions: [
    { version: "20.19.0", downloadBytes: null, installBytes: null },
    { version: "22.23.4", downloadBytes: null, installBytes: null },
  ],
  loading: false,
  busy: false,
  miseStatus: { version: "2026.10.17", present: false, downloadBytes: 81_189_867, oldVersions: [], fetching: false },
  settings,
  onChoose: vi.fn(),
  onConfirmStore: vi.fn(),
  onInstall: vi.fn(),
};

describe("InstallSection", () => {
  it("shows Flutter's download and the space it takes once installed", () => {
    render(
      <InstallSection
        {...base}
        tool="flutter"
        chosen={{ version: "3.32.8", downloadBytes: 1_749_058_829, diskBytes: 3_148_305_892 }}
      />,
    );
    expect(screen.getByText(/Download: 1\.6 GB\. Takes about 2\.9 GB on disk/)).toBeInTheDocument();
  });

  it("waits for the new mise while it downloads in the background", () => {
    const fetching = { ...base.miseStatus, fetching: true, oldVersions: ["2026.9.2"] };
    render(
      <InstallSection
        {...base}
        miseStatus={fetching}
        settings={{ ...settings, installStoreConfirmed: true }}
        chosen={{ version: "22.23.4", downloadBytes: null }}
      />,
    );
    expect(screen.getByText(/being downloaded/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install" })).toBeDisabled();
  });

  it("lists the newest versions first and reports the choice", async () => {
    const onChoose = vi.fn();
    render(<InstallSection {...base} chosen={null} onChoose={onChoose} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("22.23.4");
    await userEvent.click(screen.getByRole("button", { name: "20.19.0" }));
    expect(onChoose).toHaveBeenCalledWith("20.19.0");
  });

  it("asks for the install folder before the first install and mentions the mise download", async () => {
    const onConfirmStore = vi.fn();
    render(
      <InstallSection
        {...base}
        chosen={{ version: "22.23.4", downloadBytes: 35_651_584 }}
        onConfirmStore={onConfirmStore}
      />,
    );
    expect(screen.getByText(/Download: 34 MB/)).toBeInTheDocument();
    expect(screen.getByText(/mise 2026.10.17, 77 MB/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Use this folder" }));
    expect(onConfirmStore).toHaveBeenCalledWith(settings.installStore);
  });

  it("installs once the folder is confirmed", async () => {
    const onInstall = vi.fn();
    render(
      <InstallSection
        {...base}
        settings={{ ...settings, installStoreConfirmed: true }}
        miseStatus={{ ...base.miseStatus, present: true }}
        chosen={{ version: "22.23.4", downloadBytes: null }}
        onInstall={onInstall}
      />,
    );
    expect(screen.getByText(/not known before installing/)).toBeInTheDocument();
    expect(screen.queryByText(/pinned installer/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(onInstall).toHaveBeenCalledOnce();
  });

  it("formats sizes", () => {
    expect(formatBytes(1_934_624_561)).toBe("1.8 GB");
    expect(formatBytes(81_189_867)).toBe("77 MB");
  });
});
