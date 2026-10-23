import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeApi, inst } from "./testHarness";
import { useToolsStore } from "./useToolsStore";

describe("useToolsStore", () => {
  it("switching tools lists the new tool's installations", async () => {
    const node = inst("node", "22.23.4", "C:\\node22");
    const listToolInstallations = vi.fn(async (tool: string) => (tool === "node" ? [node] : []));
    const { result } = renderHook(() => useToolsStore("java", fakeApi({ listToolInstallations })));
    act(() => result.current.dispatch({ type: "selectTool", tool: "node" }));
    expect(result.current.state.tool).toBe("node");
    await waitFor(() => expect(result.current.state.installations).toEqual([node]));
    expect(listToolInstallations).toHaveBeenCalledWith("node");
  });

  it("starting fetches a newly pinned mise in the background without listing anything", async () => {
    const prepareMise = vi.fn(async () => false);
    const listToolInstallations = vi.fn(async () => []);
    const { result } = renderHook(() => useToolsStore("java", fakeApi({ prepareMise, listToolInstallations })));
    act(() => result.current.dispatch({ type: "started" }));
    await waitFor(() => expect(prepareMise).toHaveBeenCalledTimes(1));
    expect(listToolInstallations).not.toHaveBeenCalled();
  });

  it("keeps the same dispatch across renders", () => {
    const api = fakeApi({});
    const { result, rerender } = renderHook(() => useToolsStore("java", api));
    const first = result.current.dispatch;
    rerender();
    expect(result.current.dispatch).toBe(first);
  });
});
