import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UpdateList } from "./UpdateList";

const confirmed = { confirmed: true, installStore: "C:\\store", onConfirm: vi.fn() };

describe("UpdateList", () => {
  it("asks where installs go before the first update downloads anything", async () => {
    const onUpdate = vi.fn();
    const onConfirm = vi.fn();
    const candidate = { root: "C:\\external\\node", current: "22.13.0", latest: "22.24.0" };
    render(
      <UpdateList
        updates={[candidate]}
        busy={false}
        awaitingSwitch={false}
        onUpdate={onUpdate}
        store={{ confirmed: false, installStore: "C:\\default", onConfirm }}
      />,
    );
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Use this folder" }));
    expect(onConfirm).toHaveBeenCalledWith("C:\\default");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("offers to move the profiles to the new version, ticked by default", async () => {
    const onToggle = vi.fn();
    render(
      <UpdateList
        updates={[]}
        busy={false}
        awaitingSwitch
        onUpdate={vi.fn()}
        store={confirmed}
        repoint={{ names: ["Android work"], checked: true, onToggle }}
      />,
    );
    const box = screen.getByRole("checkbox", { name: /Android work/ });
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("offers each newer release in its line", async () => {
    const onUpdate = vi.fn();
    const candidate = { root: "C:\\jdk21", current: "21.0.12", latest: "21.0.13+11" };
    render(<UpdateList updates={[candidate]} busy={false} awaitingSwitch={false} onUpdate={onUpdate} store={confirmed} />);
    expect(screen.getByText("21.0.12 → 21.0.13+11")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(onUpdate).toHaveBeenCalledWith(candidate);
  });

  it("says so when nothing is behind, and explains the switch after installing", () => {
    render(<UpdateList updates={[]} busy={false} awaitingSwitch onUpdate={vi.fn()} store={confirmed} />);
    expect(screen.getByText(/newest release of its line/)).toBeInTheDocument();
    expect(screen.getByText(/offers to uninstall the old one/)).toBeInTheDocument();
  });
});
