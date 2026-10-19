import { describe, expect, it } from "vitest";
import { getThinkingLevels } from "../../open-sse/providers/thinkingLevels.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
import { applyThinking } from "../../open-sse/translator/concerns/thinkingUnified.js";
import { liftReasoningAliases } from "../../open-sse/translator/concerns/reasoning.js";
import { parseSSEToOpenAIResponse } from "../../open-sse/handlers/chatCore/sseToJsonHandler.js";
import { FORMATS } from "../../open-sse/translator/formats.js";
import { selectConnectionsToRefresh } from "../../src/app/(dashboard)/dashboard/usage/components/ProviderLimits/utils.js";

describe("PR #5020: oc/mimo-v2.6-flash-free reasoning & alias lifting", () => {
  it("resolves opencode/mimo-v2.6-flash-free to openai thinkingFormat with all 7 levels", () => {
    expect(getCapabilitiesForModel("opencode", "mimo-v2.6-flash-free")).toMatchObject({
      reasoning: true,
      thinkingFormat: "openai",
      thinkingCanDisable: true,
    });
    expect(getThinkingLevels("opencode", "mimo-v2.6-flash-free")).toEqual([
      "none",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
  });

  it("lifts reasoning and reasoning_details into reasoning_content without overwriting existing reasoning_content", () => {
    expect(liftReasoningAliases({ reasoning: "step 1" })).toEqual({
      reasoning: "step 1",
      reasoning_content: "step 1",
    });
    expect(liftReasoningAliases({ reasoning_details: [{ text: "part A" }, { content: " part B" }] })).toEqual({
      reasoning_details: [{ text: "part A" }, { content: " part B" }],
      reasoning_content: "part A part B",
    });
    const existing = { reasoning_content: "canonical", reasoning: "alias" };
    expect(liftReasoningAliases(existing)).toBe(existing);
  });

  it("aggregates reasoning alias deltas in parseSSEToOpenAIResponse", () => {
    const raw = [
      'data: {"id":"1","model":"mimo-v2.6-flash-free","choices":[{"index":0,"delta":{"role":"assistant","reasoning":"think1 "}}]}',
      'data: {"id":"1","model":"mimo-v2.6-flash-free","choices":[{"index":0,"delta":{"reasoning_details":[{"text":"think2"}],"content":"hello"}}]}',
      "data: [DONE]",
    ].join("\n");
    const parsed = parseSSEToOpenAIResponse(raw, "mimo-v2.6-flash-free");
    expect(parsed.choices[0].message.reasoning_content).toBe("think1 think2");
    expect(parsed.choices[0].message.content).toBe("hello");
  });
});

describe("PR #4984: oc/deepseek-v4.1-flash-free low|high|max effort", () => {
  it("advertises low|high|max and forwards low verbatim on the wire", () => {
    expect(getThinkingLevels("opencode", "deepseek-v4.1-flash-free")).toEqual(["low", "high", "max"]);
    for (const level of ["low", "high", "max"]) {
      const body = { model: "deepseek-v4.1-flash-free", messages: [], reasoning_effort: level };
      applyThinking(FORMATS.OPENAI, "deepseek-v4.1-flash-free", body, "opencode");
      expect(body.reasoning_effort).toBe(level);
    }
  });

  it("collapses minimal->low, medium->high, xhigh->max on deepseek-v4.1-flash-free", () => {
    const check = (input) => {
      const body = { model: "deepseek-v4.1-flash-free", messages: [], reasoning_effort: input };
      applyThinking(FORMATS.OPENAI, "deepseek-v4.1-flash-free", body, "opencode");
      return body.reasoning_effort;
    };
    expect(check("minimal")).toBe("low");
    expect(check("medium")).toBe("high");
    expect(check("xhigh")).toBe("max");
  });
});

describe("PR #4965: selectConnectionsToRefresh throttles Claude loading state", () => {
  const conns = [
    { id: "c1", provider: "claude" },
    { id: "v1", provider: "vertex" },
  ];

  it("excludes Claude on non-10th auto-refresh ticks and includes on 10th or force", () => {
    expect(selectConnectionsToRefresh(conns, { force: false, tick: 1 })).toEqual([{ id: "v1", provider: "vertex" }]);
    expect(selectConnectionsToRefresh(conns, { force: false, tick: 10 })).toEqual(conns);
    expect(selectConnectionsToRefresh(conns, { force: true, tick: 1 })).toEqual(conns);
  });
});
