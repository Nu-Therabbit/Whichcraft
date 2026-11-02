import { act, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

function mediaQuery(media: string, matches: boolean): MediaQueryList {
  return {
    matches,
    media,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

describe("Modal", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(window.matchMedia).mockImplementation((query) =>
      mediaQuery(query, query.includes("dark")),
    );
  });

  it("keeps the dialog mounted while its exit motion completes", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <Modal open title="Example" onClose={vi.fn()}>
        Content
      </Modal>,
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "open");

    rerender(
      <Modal open={false} title="Example" onClose={vi.fn()}>
        Content
      </Modal>,
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "closed");
    act(() => vi.advanceTimersByTime(180));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Example" onClose={onClose}>
        Content
      </Modal>,
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not wait for exit motion when reduced motion is requested", () => {
    vi.useFakeTimers();
    vi.mocked(window.matchMedia).mockImplementation((query) => mediaQuery(query, true));
    const { rerender } = render(
      <Modal open title="Example" onClose={vi.fn()}>
        Content
      </Modal>,
    );

    rerender(
      <Modal open={false} title="Example" onClose={vi.fn()}>
        Content
      </Modal>,
    );
    act(() => vi.runOnlyPendingTimers());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders outside transformed or clipped ancestors", () => {
    render(
      <div className="overflow-hidden transform-gpu">
        <Modal open title="Example" onClose={vi.fn()}>
          Content
        </Modal>
      </div>,
    );

    expect(screen.getByRole("dialog").parentElement).toBe(document.body);
  });

  describe("focus", () => {
    function Harness({ open, children }: { open: boolean; children?: ReactNode }) {
      return (
        <>
          <button type="button">Trigger</button>
          <Modal open={open} title="Example" onClose={vi.fn()}>
            {children ?? <button type="button">Save</button>}
          </Modal>
        </>
      );
    }

    function FocusesItself() {
      const ref = useRef<HTMLInputElement>(null);
      useEffect(() => ref.current?.focus(), []);
      return <input ref={ref} aria-label="Name" />;
    }

    it("moves focus into the dialog when it opens", async () => {
      const { rerender } = render(<Harness open={false} />);
      screen.getByRole("button", { name: "Trigger" }).focus();

      rerender(<Harness open />);

      await screen.findByRole("dialog");
      expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    });

    it("keeps a field the dialog's content focused for itself", async () => {
      const { rerender } = render(<Harness open={false}><FocusesItself /></Harness>);

      rerender(<Harness open><FocusesItself /></Harness>);

      expect(await screen.findByRole("textbox", { name: "Name" })).toHaveFocus();
    });

    it("returns focus to the trigger when it closes, even if the content focused itself", async () => {
      const { rerender } = render(<Harness open={false}><FocusesItself /></Harness>);
      const trigger = screen.getByRole("button", { name: "Trigger" });
      trigger.focus();
      rerender(<Harness open><FocusesItself /></Harness>);
      await screen.findByRole("textbox", { name: "Name" });

      rerender(<Harness open={false}><FocusesItself /></Harness>);

      expect(trigger).toHaveFocus();
    });

    it("does not take focus back from an element outside the dialog", async () => {
      const { rerender } = render(<Harness open={false} />);
      const trigger = screen.getByRole("button", { name: "Trigger" });
      const elsewhere = document.createElement("button");
      document.body.append(elsewhere);
      trigger.focus();
      rerender(<Harness open />);
      await screen.findByRole("dialog");

      elsewhere.focus();
      rerender(<Harness open={false} />);

      expect(elsewhere).toHaveFocus();
      elsewhere.remove();
    });

    it("cycles Tab inside the dialog in both directions", () => {
      render(<Harness open />);
      const close = screen.getByRole("button", { name: "Close" });
      const save = screen.getByRole("button", { name: "Save" });

      save.focus();
      fireEvent.keyDown(save, { key: "Tab" });
      expect(close).toHaveFocus();

      fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
      expect(save).toHaveFocus();
    });

    it("sends Shift+Tab from the panel itself to the last control", () => {
      render(<Harness open />);
      const panel = document.activeElement as HTMLElement;

      fireEvent.keyDown(panel, { key: "Tab", shiftKey: true });

      expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    });
  });
});
