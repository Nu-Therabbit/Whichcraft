import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { initialToolsState, type ToolsState } from "../../features/tools/model";
import { inst } from "../../features/tools/testHarness";
import { ToolsPanel } from "./ToolsPanel";

function stateWith(extra: Partial<ToolsState> = {}): ToolsState {
  return {
    ...initialToolsState("node"),
    settings: { installStore: "C:\\store", scanRoots: [], terminal: "windows_terminal", installStoreConfirmed: true },
    ...extra,
  };
}

const sent = (dispatch: ReturnType<typeof vi.fn>, type: string) =>
  dispatch.mock.calls.filter(([intent]) => intent.type === type);

describe("ToolsPanel", () => {
  it("reads the environment once when opened", () => {
    const dispatch = vi.fn();
    const { rerender } = render(<ToolsPanel open onClose={vi.fn()} state={stateWith()} dispatch={dispatch} />);
    rerender(<ToolsPanel open onClose={vi.fn()} state={stateWith({ loading: true })} dispatch={dispatch} />);
    expect(sent(dispatch, "refresh")).toHaveLength(1);
  });

  it("lists installable versions once when the list opens, however often the state changes", async () => {
    const dispatch = vi.fn();
    const { rerender } = render(<ToolsPanel open onClose={vi.fn()} state={stateWith()} dispatch={dispatch} />);
    await userEvent.click(screen.getByRole("button", { name: "Install a version" }));
    for (let i = 0; i < 5; i++) {
      rerender(<ToolsPanel open onClose={vi.fn()} state={stateWith({ loading: i % 2 === 0 })} dispatch={dispatch} />);
    }
    expect(sent(dispatch, "openInstallList")).toHaveLength(1);
  });

  it("turns choosing and removing an installation into intents", async () => {
    const dispatch = vi.fn();
    const node = inst("node", "22.23.4", "C:\\node22");
    render(<ToolsPanel open onClose={vi.fn()} state={stateWith({ installations: [node] })} dispatch={dispatch} />);
    await userEvent.click(screen.getByRole("button", { name: /Node\.js 22\.23\.4/ }));
    expect(dispatch).toHaveBeenCalledWith({ type: "buildPlan", root: "C:\\node22" });
    await userEvent.click(screen.getByRole("button", { name: "Uninstall" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "planUninstall", root: "C:\\node22" });
  });

  it("offers no install or update for Git", () => {
    render(<ToolsPanel open onClose={vi.fn()} state={stateWith({ tool: "git" })} dispatch={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Install a version" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check for updates" })).not.toBeInTheDocument();
  });
});
