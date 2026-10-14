// /api/usage/errors streams "requestError" events as SSE so the dashboard can toast them.
import { describe, expect, it } from "vitest";

const { GET } = await import("../../src/app/api/usage/errors/route.js");
const { statsEmitter, emitRequestError } = await import("../../src/lib/db/repos/usageRepo.js");

async function readUntil(reader, predicate, ms = 2000) {
  const dec = new TextDecoder();
  let buf = "";
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const { value, done } = await Promise.race([reader.read(), new Promise((r) => setTimeout(() => r({ timeout: true }), 200))]);
    if (done) break;
    if (value) buf += dec.decode(value);
    if (predicate(buf)) return buf;
  }
  return buf;
}

describe("GET /api/usage/errors", () => {
  it("is an event stream", async () => {
    const res = await GET();
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    await res.body.cancel();
  });

  it("forwards each requestError with the exact status and message", async () => {
    const res = await GET();
    const reader = res.body.getReader();
    await readUntil(reader, (b) => b.includes(": ready"));
    emitRequestError({ provider: "opencode", model: "m", status: 409, message: "exact upstream text" });
    const out = await readUntil(reader, (b) => b.includes("exact upstream text"));
    await reader.cancel();
    const line = out.split("\n").find((l) => l.startsWith("data: "));
    expect(JSON.parse(line.slice(6))).toMatchObject({ provider: "opencode", model: "m", status: 409, message: "exact upstream text" });
  });

  it("detaches its listener when the client disconnects", async () => {
    const before = statsEmitter.listenerCount("requestError");
    const res = await GET();
    const reader = res.body.getReader();
    await readUntil(reader, (b) => b.includes(": ready"));
    expect(statsEmitter.listenerCount("requestError")).toBe(before + 1);
    await reader.cancel();
    await new Promise((r) => setTimeout(r, 50));
    expect(statsEmitter.listenerCount("requestError")).toBe(before);
  });
});
