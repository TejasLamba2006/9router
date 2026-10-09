import { describe, expect, it } from "vitest";
import { consumeModelBatchStream } from "../../src/shared/utils/modelBatchClient.js";

function stream(parts) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
      controller.close();
    },
  });
}

describe("model batch NDJSON client", () => {
  it("parses split lines and emits progress events", async () => {
    const events = [];
    await consumeModelBatchStream(stream([
      '{"type":"start","total":2}\n{"type":"res',
      'ult","done":1,"result":{"modelId":"a","classification":"healthy","ok":true}}\n',
      '{"type":"done","done":1,"total":2}\n',
    ]), (event) => events.push(event));

    expect(events.map((event) => event.type)).toEqual(["start", "result", "done"]);
    expect(events[1].result.modelId).toBe("a");
  });

  it("parses a final line without a newline", async () => {
    const events = [];
    await consumeModelBatchStream(stream(['{"type":"done","done":0,"total":0}']), (event) => events.push(event));
    expect(events).toEqual([{ type: "done", done: 0, total: 0 }]);
  });
});
