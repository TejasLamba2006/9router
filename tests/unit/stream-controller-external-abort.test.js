import { describe, expect, it, vi } from "vitest";
import { createStreamController } from "../../open-sse/utils/streamHandler.js";

describe("stream controller external abort", () => {
  it("forwards an external abort to the executor signal", () => {
    const external = new AbortController();
    const controller = createStreamController({ signal: external.signal });
    expect(controller.signal.aborted).toBe(false);
    external.abort(new Error("cancelled"));
    expect(controller.signal.aborted).toBe(true);
  });

  it("removes the external listener after completion", () => {
    const external = new AbortController();
    const remove = vi.spyOn(external.signal, "removeEventListener");
    const controller = createStreamController({ signal: external.signal });
    controller.handleComplete();
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});
