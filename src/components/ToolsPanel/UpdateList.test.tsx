import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UpdateList } from "./UpdateList";

describe("UpdateList", () => {
  it("offers each newer release in its line", async () => {
    const onUpdate = vi.fn();
    const candidate = { root: "C:\\jdk21", current: "21.0.12", latest: "21.0.13+11" };
    render(<UpdateList updates={[candidate]} busy={false} awaitingSwitch={false} onUpdate={onUpdate} />);
    expect(screen.getByText("21.0.12 → 21.0.13+11")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(onUpdate).toHaveBeenCalledWith(candidate);
  });

  it("says so when nothing is behind, and explains the switch after installing", () => {
    render(<UpdateList updates={[]} busy={false} awaitingSwitch onUpdate={vi.fn()} />);
    expect(screen.getByText(/newest release of its line/)).toBeInTheDocument();
    expect(screen.getByText(/offers to uninstall the old one/)).toBeInTheDocument();
  });
});
