import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RecoveryView } from "../../types";
import { RecoveryBanner } from "./RecoveryBanner";

const halfWritten: RecoveryView = {
  journalId: "apply-1",
  kind: "java_apply",
  createdAt: "2026-10-23T09:00:00Z",
  canResume: true,
  items: [
    { name: "JAVA_HOME", scope: "User", state: "written", before: "C:\\jdk11", after: "C:\\jdk17", current: "C:\\jdk17" },
    { name: "Path", scope: "User", state: "notWritten", before: "C:\\u", after: "C:\\jdk17\\bin;C:\\u", current: "C:\\u" },
  ],
};

describe("RecoveryBanner", () => {
  it("shows the state of each change", () => {
    render(<RecoveryBanner recovery={halfWritten} busy={false} onResume={vi.fn()} onRollBack={vi.fn()} />);
    expect(screen.getByText("Written")).toBeInTheDocument();
    expect(screen.getByText("Not written")).toBeInTheDocument();
  });

  it("finishes or rolls back on request", async () => {
    const onResume = vi.fn();
    const onRollBack = vi.fn();
    render(<RecoveryBanner recovery={halfWritten} busy={false} onResume={onResume} onRollBack={onRollBack} />);
    await userEvent.click(screen.getByRole("button", { name: "Finish the apply" }));
    await userEvent.click(screen.getByRole("button", { name: "Roll back" }));
    expect(onResume).toHaveBeenCalledOnce();
    expect(onRollBack).toHaveBeenCalledOnce();
  });

  it("only offers roll back when a variable changed elsewhere", () => {
    const changed: RecoveryView = {
      ...halfWritten,
      canResume: false,
      items: [{ ...halfWritten.items[1], state: "changedElsewhere", current: "C:\\u;C:\\installer" }],
    };
    render(<RecoveryBanner recovery={changed} busy={false} onResume={vi.fn()} onRollBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Finish the apply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Roll back" })).toBeEnabled();
    expect(screen.getByText("C:\\u;C:\\installer")).toBeInTheDocument();
  });
});
