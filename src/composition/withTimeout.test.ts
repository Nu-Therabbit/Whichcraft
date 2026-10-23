import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./withTimeout";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the real value if it arrives before the timeout", async () => {
    const promise = withTimeout(Promise.resolve("real"), 3000, "fallback");
    await expect(promise).resolves.toBe("real");
  });

  it("resolves with the fallback if the promise never settles", async () => {
    const never = new Promise<string>(() => {});
    const promise = withTimeout(never, 3000, "fallback");

    await vi.advanceTimersByTimeAsync(3000);

    await expect(promise).resolves.toBe("fallback");
  });

  it("resolves with the fallback if the promise rejects", async () => {
    const promise = withTimeout(Promise.reject(new Error("boom")), 3000, "fallback");
    await expect(promise).resolves.toBe("fallback");
  });
});
