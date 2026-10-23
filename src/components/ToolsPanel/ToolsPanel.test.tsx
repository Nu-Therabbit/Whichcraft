import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WhichcraftSettings } from "../../types";
import { ToolsPanel } from "./ToolsPanel";

const settings: WhichcraftSettings = {
  installStore: "C:\\store",
  scanRoots: [],
  terminal: "windows_terminal",
  installStoreConfirmed: true,
};

function panel(onOpen: () => void) {
  return (
    <ToolsPanel
      open
      onClose={vi.fn()}
      tool="node"
      onToolChange={vi.fn()}
      installations={[]}
      loading={false}
      error={null}
      plan={null}
      planBusy={false}
      applyBusy={false}
      onRefresh={() => {}}
      onSelect={vi.fn()}
      onApplyPlan={vi.fn()}
      onUndo={vi.fn()}
      onClearPlan={vi.fn()}
      settings={settings}
      onSaveSettings={vi.fn()}
      install={{
        versions: [],
        loading: false,
        busy: false,
        miseStatus: null,
        chosen: null,
        onOpen,
        onChoose: vi.fn(),
        onInstall: vi.fn(),
      }}
    />
  );
}

describe("ToolsPanel", () => {
  it("loads installable versions once when the list opens, however often the parent re-renders", async () => {
    const loads = vi.fn();
    // A parent that passes a new arrow function on every render, as an inline prop does.
    const { rerender } = render(panel(() => loads()));
    await userEvent.click(screen.getByRole("button", { name: "Install a version" }));
    for (let i = 0; i < 5; i++) rerender(panel(() => loads()));
    expect(loads).toHaveBeenCalledTimes(1);
  });
});
