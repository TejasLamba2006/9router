// Failed upstream requests are pushed to the dashboard as toasts. The usage layer
// emits one "requestError" event per failure with the exact upstream status and text,
// and the formatter turns it into the toast copy.
import { describe, expect, it, vi } from "vitest";

const { statsEmitter, emitRequestError } = await import("../../src/lib/db/repos/usageRepo.js");
const { formatRequestErrorToast } = await import("../../src/shared/utils/requestErrorToast.js");

function capture() {
  const seen = [];
  const handler = (e) => seen.push(e);
  statsEmitter.on("requestError", handler);
  return { seen, stop: () => statsEmitter.off("requestError", handler) };
}

describe("emitRequestError", () => {
  it("emits provider, model, status and the exact upstream message", () => {
    const { seen, stop } = capture();
    emitRequestError({ provider: "opencode", model: "mimo-v2.6-flash-free", status: 403, message: "FreeTierError: nope" });
    stop();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ provider: "opencode", model: "mimo-v2.6-flash-free", status: 403, message: "FreeTierError: nope" });
    expect(typeof seen[0].id).toBe("string");
    expect(typeof seen[0].ts).toBe("number");
  });

  it("gives every event a distinct id", () => {
    const { seen, stop } = capture();
    emitRequestError({ provider: "a", model: "m", status: 404, message: "x" });
    emitRequestError({ provider: "a", model: "m", status: 404, message: "x" });
    stop();
    expect(new Set(seen.map((e) => e.id)).size).toBe(2);
  });

  it("caps very long upstream bodies so one error cannot flood the toast", () => {
    const { seen, stop } = capture();
    emitRequestError({ provider: "a", model: "m", status: 500, message: "z".repeat(20000) });
    stop();
    expect(seen[0].message.length).toBeLessThanOrEqual(2000);
  });

  it("never throws on missing fields", () => {
    expect(() => emitRequestError({})).not.toThrow();
    expect(() => emitRequestError(undefined)).not.toThrow();
  });

  it("does not emit when there is no status and no message", () => {
    const { seen, stop } = capture();
    emitRequestError({});
    stop();
    expect(seen).toHaveLength(0);
  });
});

describe("formatRequestErrorToast", () => {
  it("shows status, provider/model and the raw upstream message", () => {
    const t = formatRequestErrorToast({ status: 409, provider: "antigravity", model: "gemini-3", message: "[409]: conflict happened" });
    expect(t.title).toBe("409 · antigravity/gemini-3");
    expect(t.message).toBe("[409]: conflict happened");
  });

  it("falls back to a generic label without a status", () => {
    const t = formatRequestErrorToast({ provider: "openai", model: "gpt-x", message: "socket hang up" });
    expect(t.title).toBe("Request failed · openai/gpt-x");
    expect(t.message).toBe("socket hang up");
  });

  it("omits the provider/model segment when neither is known", () => {
    expect(formatRequestErrorToast({ status: 404, message: "not found" }).title).toBe("404");
  });

  it("uses a placeholder when the upstream sent no body", () => {
    expect(formatRequestErrorToast({ status: 502, provider: "p", model: "m" }).message).toBe("No error body returned by the provider");
  });
});

describe("pollRequestErrors", () => {
  const mkFetch = (pages) => {
    const urls = [];
    const impl = async (url) => {
      urls.push(url);
      const page = pages.shift() || { events: [], now: 0 };
      return { ok: true, json: async () => page };
    };
    return { impl, urls };
  };
  const ev = (id, status = 403) => ({ id, ts: 1, provider: "p", model: "m", status, message: `m-${id}` });

  it("delivers each event once and advances the cursor from the server clock", async () => {
    const { pollRequestErrors } = await import("../../src/shared/utils/requestErrorToast.js");
    const got = [];
    const state = { since: 0, seen: new Set() };
    const { impl, urls } = mkFetch([
      { events: [ev("a"), ev("b", 404)], now: 10_000 },
      { events: [ev("b", 404), ev("c", 409)], now: 20_000 },
    ]);
    await pollRequestErrors(state, (e) => got.push(e.id), impl);
    await pollRequestErrors(state, (e) => got.push(e.id), impl);
    expect(got).toEqual(["a", "b", "c"]);
    expect(urls[0]).toContain("since=0");
    expect(urls[1]).toContain("since=9000");
  });

  it("ignores a failed poll without moving the cursor", async () => {
    const { pollRequestErrors } = await import("../../src/shared/utils/requestErrorToast.js");
    const state = { since: 5, seen: new Set() };
    await pollRequestErrors(state, () => { throw new Error("must not fire"); }, async () => ({ ok: false }));
    expect(state.since).toBe(5);
  });
});
