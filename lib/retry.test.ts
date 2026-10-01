import { describe, expect, it, vi } from "vitest";
import { withRetry } from "./retry";

describe("withRetry", () => {
  it("returns the first success", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("blip")).mockResolvedValue("ok");
    await expect(withRetry(fn, [0, 0])).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it("gives up after the last delay and rethrows the last error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("down"));
    await expect(withRetry(fn, [0, 0])).rejects.toThrow("down");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
