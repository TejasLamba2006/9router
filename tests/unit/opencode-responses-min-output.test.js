import { describe, expect, it } from "vitest";
import { OpenCodeExecutor } from "../../open-sse/executors/opencode.js";

const MODEL = "muse-spark-1.3-contributor-free";
const input = [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }];
const creds = { connectionId: "opencode-min-output-test" };
const send = (extra) => new OpenCodeExecutor().transformRequest(MODEL, { input, ...extra }, true, creds);

// Console rejects max_output_tokens < 16 ("The number must be >= 16"), and Claude Code's
// /model check sends max_tokens: 1.
describe("OpenCode Responses output-token floor", () => {
  it.each([1, 5, 15])("raises max_tokens %i to 16", (n) => {
    expect(send({ max_tokens: n }).max_output_tokens).toBe(16);
  });
  it("raises max_completion_tokens and an explicit max_output_tokens too", () => {
    expect(send({ max_completion_tokens: 2 }).max_output_tokens).toBe(16);
    expect(send({ max_output_tokens: 3 }).max_output_tokens).toBe(16);
  });
  it.each([16, 17, 4096, 131072])("leaves %i alone", (n) => {
    expect(send({ max_tokens: n }).max_output_tokens).toBe(n);
  });
  it("adds no cap when the client sent none", () => {
    expect(send({}).max_output_tokens).toBeUndefined();
  });
  it("passes non-numbers through and floors zero", () => {
    expect(send({ max_tokens: "abc" }).max_output_tokens).toBe("abc");
    expect(send({ max_tokens: 0 }).max_output_tokens).toBe(16);
  });
});
