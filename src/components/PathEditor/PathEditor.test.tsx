import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import type { EnvironmentApi } from "../../features/environment/api";
import { fakePlatformApi } from "../../test/fakePlatformApi";
import { renderWithEnvironmentApi } from "../../test/renderWithEnvironmentApi";
import type { EnvVar } from "../../types";
import { PathEditor } from "./PathEditor";

function renderEditor(ui: React.ReactElement) {
  return renderWithEnvironmentApi(ui, api as unknown as EnvironmentApi, {
    platform: fakePlatformApi({ pickFolder }),
  });
}

vi.mock("../../api", () => ({
  api: {
    validatePaths: vi.fn(),
  },
}));

const pickFolder = vi.fn<(defaultPath?: string) => Promise<string | null>>();

const A = "/usr/local/bin";
const B = "/nonexistent/path";
const C = "/usr/bin";
const RAW = `${A};${B};${C}`;

describe("PathEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.validatePaths).mockResolvedValue([true, false, true]);
    pickFolder.mockResolvedValue(null);
  });

  it("renders each path entry", () => {
    renderEditor(<PathEditor rawValue={RAW} onChange={vi.fn()} />);
    // Entries are rendered as controlled inputs
    expect(screen.getByDisplayValue(A)).toBeInTheDocument();
    expect(screen.getByDisplayValue(B)).toBeInTheDocument();
    expect(screen.getByDisplayValue(C)).toBeInTheDocument();
  });

  it("marks invalid paths after validation", async () => {
    renderEditor(<PathEditor rawValue={RAW} onChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText(/not found/).length).toBeGreaterThan(0);
    });
  });

  it("shows warning count for invalid paths", async () => {
    renderEditor(<PathEditor rawValue={RAW} onChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/1 path not found/i)).toBeInTheDocument();
    });
  });

  it("adds a new entry on Add click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    vi.mocked(api.validatePaths).mockResolvedValue([true, true]);
    renderEditor(<PathEditor rawValue={A} onChange={onChange} />);
    await user.type(screen.getByPlaceholderText(/add new path/i), "/new/path");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(onChange).toHaveBeenCalledWith(`${A};/new/path`);
  });

  it("adds a selected folder from the new entry controls", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    vi.mocked(api.validatePaths).mockResolvedValue([true, true]);
    pickFolder.mockResolvedValue("/selected/new");
    renderEditor(<PathEditor rawValue={A} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /browse folder to add/i }));

    expect(pickFolder).toHaveBeenCalledWith(undefined);
    expect(onChange).toHaveBeenCalledWith(`${A};/selected/new`);
  });

  it("uses the typed new entry value as the folder picker default path", async () => {
    const user = userEvent.setup();
    pickFolder.mockResolvedValue(null);
    renderEditor(<PathEditor rawValue={A} onChange={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/add new path/i), "/partial");
    await user.click(screen.getByRole("button", { name: /browse folder to add/i }));

    expect(pickFolder).toHaveBeenCalledWith("/partial");
  });

  it("adds entry on Enter key", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    vi.mocked(api.validatePaths).mockResolvedValue([true]);
    renderEditor(<PathEditor rawValue="" onChange={onChange} />);
    await user.type(screen.getByPlaceholderText(/add new path/i), "/my/path{Enter}");
    expect(onChange).toHaveBeenCalledWith("/my/path");
  });

  it("removes an entry when remove button is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    vi.mocked(api.validatePaths).mockResolvedValue([true, true]);
    renderEditor(<PathEditor rawValue={`${A};${C}`} onChange={onChange} />);
    const removeButtons = await screen.findAllByRole("button", { name: /^remove/i });
    await user.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith(C);
  });

  it("updates an entry with the selected folder path", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    vi.mocked(api.validatePaths).mockResolvedValue([true, true]);
    pickFolder.mockResolvedValue("/selected/bin");
    renderEditor(<PathEditor rawValue={`${A};${C}`} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: `Browse folder for ${A}` }));

    expect(pickFolder).toHaveBeenCalledWith(A);
    expect(onChange).toHaveBeenCalledWith(`/selected/bin;${C}`);
  });

  it("can hide folder picker buttons for non-folder path lists", () => {
    renderEditor(<PathEditor rawValue=".COM;.EXE;.BAT" onChange={vi.fn()} allowFolderBrowse={false} />);

    expect(screen.queryByRole("button", { name: /browse folder for/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /browse folder to add/i })).not.toBeInTheDocument();
  });

  it("prevents row edits and controls when read-only", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderEditor(<PathEditor rawValue={`${A};${C}`} onChange={onChange} readOnly />);

    await user.type(screen.getByDisplayValue(A), "-edited");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^remove/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /browse folder for/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /browse folder to add/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
  });

  it("moves focus between entries with arrow keys", () => {
    vi.mocked(api.validatePaths).mockResolvedValue([true, true]);
    renderEditor(<PathEditor rawValue={`${A};${C}`} onChange={vi.fn()} />);

    const first = screen.getByDisplayValue(A);
    const second = screen.getByDisplayValue(C);
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(second).toHaveFocus();

    fireEvent.keyDown(second, { key: "ArrowUp" });
    expect(first).toHaveFocus();
  });

  it("reorders entries with Alt and arrow keys", () => {
    const onChange = vi.fn();
    vi.mocked(api.validatePaths).mockResolvedValue([true, true]);
    renderEditor(<PathEditor rawValue={`${A};${C}`} onChange={onChange} />);

    fireEvent.keyDown(screen.getByDisplayValue(A), { key: "ArrowDown", altKey: true });

    expect(onChange).toHaveBeenCalledWith(`${C};${A}`);
  });

  it("shows unresolvable reference warning when allVars is provided and a %VAR% is unknown", () => {
    const knownVars: EnvVar[] = [
      { name: "SystemRoot", scope: "System", value: "C:\\Windows", listSeparator: null },
    ];
    vi.mocked(api.validatePaths).mockResolvedValue([false]);
    renderEditor(<PathEditor rawValue="%CustomSdk%\\bin" onChange={vi.fn()} allVars={knownVars} />);
    expect(screen.getByRole("alert", { hidden: false })).toHaveTextContent(/unresolvable/i);
    expect(screen.getByText(/%CustomSdk%/)).toBeInTheDocument();
  });

  it("does not show unresolvable reference warning when allVars is not provided", () => {
    vi.mocked(api.validatePaths).mockResolvedValue([false]);
    renderEditor(<PathEditor rawValue="%CustomSdk%\\bin" onChange={vi.fn()} />);
    expect(screen.queryByText(/unresolvable/i)).not.toBeInTheDocument();
  });

  it("does not show unresolvable reference warning when all %VAR% refs resolve", () => {
    const knownVars: EnvVar[] = [
      { name: "SystemRoot", scope: "System", value: "C:\\Windows", listSeparator: null },
    ];
    vi.mocked(api.validatePaths).mockResolvedValue([true]);
    renderEditor(<PathEditor rawValue="%SystemRoot%\\system32" onChange={vi.fn()} allVars={knownVars} />);
    expect(screen.queryByText(/unresolvable/i)).not.toBeInTheDocument();
  });
});
