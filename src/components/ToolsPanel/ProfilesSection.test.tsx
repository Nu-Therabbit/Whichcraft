import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProfileToolPin, ToolProfile } from "../../types";
import { ProfilesSection } from "./ProfilesSection";

const java17: ProfileToolPin = { tool: "java", vendor: "Eclipse Adoptium", version: "17.0.20.1", preferredRoot: null };
const node20: ProfileToolPin = { tool: "node", vendor: "Node.js", version: "20.19.0", preferredRoot: null };
const android: ToolProfile = { id: "a", name: "Android work", tools: [java17, node20] };

const handlers = () => ({
  onCreate: vi.fn(),
  onDelete: vi.fn(),
  onApply: vi.fn(),
  onCheckMissing: vi.fn(),
  onInstallMissing: vi.fn(),
});

describe("ProfilesSection", () => {
  it("shows whether each profile matches and applies one that differs", async () => {
    const h = handlers();
    render(
      <ProfilesSection
        profiles={[{ profile: android, matchesEffective: false, unavailable: [] }]}
        current={[]}
        missing={null}
        busy={false}
        {...h}
      />,
    );
    expect(screen.getByText("Differs from what is in effect")).toBeInTheDocument();
    expect(screen.queryByText(/currently active/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(h.onApply).toHaveBeenCalledWith(android);
  });

  it("offers to install what is missing with its size, then apply", async () => {
    const h = handlers();
    render(
      <ProfilesSection
        profiles={[{ profile: android, matchesEffective: false, unavailable: [node20] }]}
        current={[]}
        missing={{ profileId: "a", items: [{ pin: node20, installVersion: "20.19.0", downloadBytes: 30 * 1024 ** 2 }] }}
        busy={false}
        {...h}
      />,
    );
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Install the missing ones (30 MB), then apply" }));
    expect(h.onInstallMissing).toHaveBeenCalledWith(android);
  });

  it("does not offer installing when something cannot be installed", () => {
    const pinned = { ...java17, vendor: "JetBrains s.r.o." };
    render(
      <ProfilesSection
        profiles={[{ profile: android, matchesEffective: false, unavailable: [pinned] }]}
        current={[]}
        missing={{ profileId: "a", items: [{ pin: pinned, installVersion: null, downloadBytes: null }] }}
        busy={false}
        {...handlers()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Install the missing/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing is written/)).toBeInTheDocument();
  });

  it("saves a new profile with only the tools left ticked", async () => {
    const h = handlers();
    render(<ProfilesSection profiles={[]} current={[java17, node20]} missing={null} busy={false} {...h} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Node\.js/ }));
    await userEvent.type(screen.getByRole("textbox", { name: "Profile name" }), "JDK only");
    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(h.onCreate).toHaveBeenCalledWith("JDK only", [java17]);
  });
});
