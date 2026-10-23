import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WhichcraftSettings } from "../../types";
import { ToolsSettings } from "./ToolsSettings";

const settings: WhichcraftSettings = {
  installStore: "C:\\Users\\me\\AppData\\Local\\Whichcraft\\installs",
  previousInstallStores: [],
  scanRoots: [],
  terminal: "windows_terminal",
};

describe("ToolsSettings", () => {
  it("adds a scan folder", async () => {
    const onSave = vi.fn();
    render(<ToolsSettings settings={settings} busy={false} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText("Folder to scan"), "E:\\Dev");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onSave).toHaveBeenCalledWith({ ...settings, scanRoots: ["E:\\Dev"] });
  });

  it("removes a scan folder", async () => {
    const onSave = vi.fn();
    render(<ToolsSettings settings={{ ...settings, scanRoots: ["E:\\Dev"] }} busy={false} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onSave).toHaveBeenCalledWith({ ...settings, scanRoots: [] });
  });

  it("saves a new install folder and lists earlier ones", async () => {
    const onSave = vi.fn();
    render(
      <ToolsSettings
        settings={{ ...settings, previousInstallStores: ["D:\\old-tools"] }}
        busy={false}
        onSave={onSave}
      />,
    );
    expect(screen.getByText("D:\\old-tools")).toBeInTheDocument();
    const input = screen.getByLabelText("Install folder");
    await userEvent.clear(input);
    await userEvent.type(input, "D:\\tools");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ installStore: "D:\\tools" }));
  });

  it("switches the terminal", async () => {
    const onSave = vi.fn();
    render(<ToolsSettings settings={settings} busy={false} onSave={onSave} />);
    await userEvent.selectOptions(screen.getByLabelText("Terminal"), "cmd");
    expect(onSave).toHaveBeenCalledWith({ ...settings, terminal: "cmd" });
  });
});
