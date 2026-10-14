// /api/usage/errors returns failed-request events newer than ?since so the dashboard can
// toast them. Polling (not a long-lived stream) keeps it clear of the browser's
// 6-connections-per-origin limit and loses nothing across a reload.
import { describe, expect, it } from "vitest";

const { GET } = await import("../../src/app/api/usage/errors/route.js");
const { emitRequestError } = await import("../../src/lib/db/repos/usageRepo.js");

const call = async (since) => {
  const res = await GET(new Request(`http://localhost/api/usage/errors${since == null ? "" : `?since=${since}`}`));
  return { res, body: await res.json() };
};

describe("GET /api/usage/errors", () => {
  it("returns json with a server clock", async () => {
    const { res, body } = await call();
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(Array.isArray(body.events)).toBe(true);
    expect(typeof body.now).toBe("number");
  });

  it("returns only events newer than since, oldest first, with exact status and message", async () => {
    const { body: start } = await call();
    emitRequestError({ provider: "opencode", model: "m", status: 409, message: "exact upstream text" });
    emitRequestError({ provider: "openai", model: "n", status: 404, message: "second" });
    const { body } = await call(start.now - 1);
    const mine = body.events.filter((e) => ["exact upstream text", "second"].includes(e.message));
    expect(mine.map((e) => e.status)).toEqual([409, 404]);
    expect(mine[0]).toMatchObject({ provider: "opencode", model: "m" });
    const later = await call(body.now + 1);
    expect(later.body.events).toHaveLength(0);
  });

  it("is never cached", async () => {
    const { res } = await call();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("keeps a bounded history", async () => {
    for (let i = 0; i < 80; i++) emitRequestError({ provider: "p", model: "m", status: 500, message: `flood-${i}` });
    const { body } = await call(0);
    expect(body.events.length).toBeLessThanOrEqual(50);
    expect(body.events.at(-1).message).toBe("flood-79");
  });

  it("treats a bad since as the beginning", async () => {
    const { res } = await call("not-a-number");
    expect(res.status).toBe(200);
  });
});
