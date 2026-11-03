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

  it("does not add a folder that does not exist, and says why", async () => {
    const onSave = vi.fn();
    const pathsExist = vi.fn(async (paths: string[]) => paths.map(() => false));
    render(<ToolsSettings settings={settings} busy={false} onSave={onSave} pathsExist={pathsExist} />);
    await userEvent.type(screen.getByLabelText("Folder to scan"), "E:\\Dvv{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("E:\\Dvv does not exist");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("treats a different case or a trailing backslash as the same folder", async () => {
    const onSave = vi.fn();
    render(<ToolsSettings settings={{ ...settings, scanRoots: ["E:\\Dev"] }} busy={false} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText("Folder to scan"), "e:\\dev\\");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent("e:\\dev is already in the list.");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("adds the folder picked with Browse", async () => {
    const onSave = vi.fn();
    const pickFolder = vi.fn(async () => "E:\\Dev\\sdks");
    const pathsExist = vi.fn(async (paths: string[]) => paths.map(() => true));
    render(
      <ToolsSettings settings={settings} busy={false} onSave={onSave} pickFolder={pickFolder} pathsExist={pathsExist} />,
    );
    await userEvent.click(screen.getAllByRole("button", { name: "Browse…" })[0]);
    expect(onSave).toHaveBeenCalledWith({ ...settings, scanRoots: ["E:\\Dev\\sdks"] });
  });

  it("marks a saved scan folder that has disappeared", async () => {
    const pathsExist = vi.fn(async (paths: string[]) => paths.map((p) => p !== "F:\\gone"));
    render(
      <ToolsSettings
        settings={{ ...settings, scanRoots: ["E:\\Dev", "F:\\gone"] }}
        busy={false}
        onSave={vi.fn()}
        pathsExist={pathsExist}
      />,
    );
    expect(await screen.findByText("Folder not found")).toBeInTheDocument();
    expect(screen.getAllByText("Folder not found")).toHaveLength(1);
  });

  it("warns when the typed install folder does not exist yet", async () => {
    const pathsExist = vi.fn(async (paths: string[]) => paths.map((p) => p === settings.installStore));
    render(<ToolsSettings settings={settings} busy={false} onSave={vi.fn()} pathsExist={pathsExist} />);
    const input = screen.getByLabelText("Install folder");
    await userEvent.clear(input);
    await userEvent.type(input, "D:\\tols");
    expect(await screen.findByText(/This folder does not exist yet/)).toBeInTheDocument();
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
