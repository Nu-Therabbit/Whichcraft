import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

const options = [
  { value: "user", label: "User" },
  { value: "system", label: "System" },
];

describe("SegmentedControl", () => {
  it("groups its radios so the group is one tab stop", () => {
    render(<SegmentedControl aria-label="Scope" options={options} value="user" onChange={vi.fn()} />);

    const [user, system] = screen.getAllByRole("radio");
    expect(user).toHaveAttribute("name");
    expect(system).toHaveAttribute("name", user.getAttribute("name"));
  });

  it("keeps each control's radios in their own group", () => {
    render(
      <>
        <SegmentedControl aria-label="Scope" options={options} value="user" onChange={vi.fn()} />
        <SegmentedControl aria-label="Other" options={options} value="user" onChange={vi.fn()} />
      </>,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0].getAttribute("name")).not.toBe(radios[2].getAttribute("name"));
  });

  it("shows keyboard focus on the visible label, because the radio itself is hidden", () => {
    render(<SegmentedControl aria-label="Scope" options={options} value="user" onChange={vi.fn()} />);

    expect(screen.getByText("User").closest("label")).toHaveClass("has-[:focus-visible]:ring-2");
  });
});
