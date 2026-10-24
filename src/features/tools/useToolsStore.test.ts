import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeToolsRuntime, inst } from "../../test/toolsTestHarness";
import { useToolsStore } from "./useToolsStore";

describe("useToolsStore", () => {
  it("switching tools lists the new tool's installations", async () => {
    const node = inst("node", "22.23.4", "C:\\node22");
    const listToolInstallations = vi.fn(async (tool: string) => (tool === "node" ? [node] : []));
    const { runtime } = fakeToolsRuntime({ listToolInstallations });
    const { result } = renderHook(() => useToolsStore("java", runtime));
    act(() => result.current.dispatch({ type: "selectTool", tool: "node" }));
    expect(result.current.state.tool).toBe("node");
    await waitFor(() => expect(result.current.state.installations).toEqual([node]));
    expect(listToolInstallations).toHaveBeenCalledWith("node");
  });

  it("starting fetches a newly pinned mise in the background without listing anything", async () => {
    const prepareMise = vi.fn(async () => false);
    const listToolInstallations = vi.fn(async () => []);
    const { runtime } = fakeToolsRuntime({ prepareMise, listToolInstallations });
    const { result } = renderHook(() => useToolsStore("java", runtime));
    act(() => result.current.dispatch({ type: "started" }));
    await waitFor(() => expect(prepareMise).toHaveBeenCalledTimes(1));
    expect(listToolInstallations).not.toHaveBeenCalled();
  });

  it("keeps the same dispatch across renders", () => {
    const { runtime } = fakeToolsRuntime({});
    const { result, rerender } = renderHook(() => useToolsStore("java", runtime));
    const first = result.current.dispatch;
    rerender();
    expect(result.current.dispatch).toBe(first);
  });
});
