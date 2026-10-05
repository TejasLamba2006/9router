import { describe, expect, it } from "vitest";
import { claudeToOpenAIRequest } from "../../open-sse/translator/request/claude-to-openai.js";

const body = { max_tokens: 1000, messages: [{ role: "user", content: "hi" }] };

describe("claudeToOpenAIRequest max token field (#1745)", () => {
  it.each(["gpt-5", "gpt-5.2-mini", "openai/gpt-5", "o1", "o3", "o4-mini", "openai/o3"])(
    "%s uses max_completion_tokens",
    (model) => {
      const out = claudeToOpenAIRequest(model, body, false);
      expect(out.max_completion_tokens).toBeGreaterThan(0);
      expect(out.max_tokens).toBeUndefined();
    },
  );

  it.each(["gpt-4o", "claude-sonnet-4", "pro3", "foo4", "deepseek-chat"])(
    "%s keeps max_tokens",
    (model) => {
      const out = claudeToOpenAIRequest(model, body, false);
      expect(out.max_tokens).toBeGreaterThan(0);
      expect(out.max_completion_tokens).toBeUndefined();
    },
  );
});
