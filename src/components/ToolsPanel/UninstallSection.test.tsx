import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ToolInstallationView, UninstallPlan } from "../../types";
import { UninstallSection } from "./UninstallSection";

const jdk = (version: string, root: string, extra: Partial<ToolInstallationView> = {}): ToolInstallationView => ({
  tool: "java",
  vendor: "Eclipse Adoptium",
  version,
  root,
  managed: false,
  effective: false,
  selected: false,
  available: true,
  installerKind: "msi",
  mismatchReason: null,
  ...extra,
});

const plan = (extra: Partial<UninstallPlan> = {}): UninstallPlan => ({
  installation: jdk("17.0.20.1", "C:\\jdk17"),
  method: { kind: "uninstaller", program: "msiexec.exe", args: ["/x", "{ABC}"] },
  usage: { processes: [], folderLocked: false },
  needsReplacement: false,
  replacements: [],
  affectedProfiles: [],
  gradleHint: false,
  noConfirmation: false,
  ...extra,
});

const handlers = () => ({ onConfirm: vi.fn(), onOpenFolder: vi.fn(), onClose: vi.fn() });

describe("UninstallSection", () => {
  it("shows the uninstaller it will run and confirms without a replacement", async () => {
    const h = handlers();
    render(<UninstallSection plan={plan()} outcome={null} busy={false} {...h} />);
    expect(screen.getByText("msiexec.exe /x {ABC}")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Uninstall" }));
    expect(h.onConfirm).toHaveBeenCalledWith(null, false);
  });

  it("suggests the updated version and repoints profiles unless unticked", async () => {
    const h = handlers();
    const p = plan({ replacements: [jdk("21.0.13", "C:\\jdk21-new")], affectedProfiles: ["Android work"] });
    render(<UninstallSection plan={p} outcome={null} busy={false} defaultReplacement={"C:\\jdk21-new"} {...h} />);
    const repoint = screen.getByRole("checkbox", { name: /Point those profiles/ });
    expect(repoint).toBeChecked();
    await userEvent.click(repoint);
    await userEvent.click(screen.getByRole("button", { name: "Uninstall" }));
    expect(h.onConfirm).toHaveBeenCalledWith("C:\\jdk21-new", false);
  });

  it("will not remove an installation that is in use", () => {
    const usage = { processes: ["OpenJDK Platform binary (PID 42)"], folderLocked: false };
    render(<UninstallSection plan={plan({ usage, gradleHint: true })} outcome={null} busy={false} {...handlers()} />);
    expect(screen.getByText("OpenJDK Platform binary (PID 42)")).toBeInTheDocument();
    expect(screen.getByText(/gradlew --stop/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uninstall" })).toBeDisabled();
  });

  it("will not remove a refused installation but can open its folder", async () => {
    const h = handlers();
    const method = { kind: "refused" as const, reason: "Android Studio is managed by another tool; remove it there" };
    render(<UninstallSection plan={plan({ method })} outcome={null} busy={false} {...h} />);
    expect(screen.getByText(/Android Studio is managed by another tool/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uninstall" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Open folder" }));
    expect(h.onOpenFolder).toHaveBeenCalledWith("C:\\jdk17");
  });

  it("warns when the uninstaller will not ask again", () => {
    render(<UninstallSection plan={plan({ noConfirmation: true })} outcome={null} busy={false} {...handlers()} />);
    expect(screen.getByText(/without asking again/)).toBeInTheDocument();
  });

  it("asks for a replacement when the installation is selected", async () => {
    const h = handlers();
    const p = plan({ needsReplacement: true, replacements: [jdk("21.0.12", "C:\\jdk21")], affectedProfiles: ["Android work"] });
    render(<UninstallSection plan={p} outcome={null} busy={false} {...h} />);
    expect(screen.getByText(/Android work/)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Uninstall" });
    expect(confirm).toBeDisabled();
    await userEvent.selectOptions(screen.getByRole("combobox"), "C:\\jdk21");
    await userEvent.click(confirm);
    expect(h.onConfirm).toHaveBeenCalledWith("C:\\jdk21", true);
  });

  it("offers to open a folder the uninstaller left behind", async () => {
    const h = handlers();
    render(
      <UninstallSection plan={null} outcome={{ status: "incomplete", remaining: "C:\\jdk17" }} busy={false} {...h} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open folder" }));
    expect(h.onOpenFolder).toHaveBeenCalledWith("C:\\jdk17");
  });
});
