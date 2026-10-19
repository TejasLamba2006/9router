import { register } from "../index.js";
import { FORMATS } from "../formats.js";
import { openaiToGeminiRequest } from "./openai-to-gemini.js";
import {
  DEFAULT_THINKING_AG_SIGNATURE,
  DEFAULT_THINKING_VERTEX_SIGNATURE,
} from "../../config/defaultThinkingSignature.js";

/**
 * Post-process a Gemini-format body for Vertex AI compatibility:
 *
 * 1. Remove standalone synthetic thoughtSignature parts (`text === ""` without `thought`).
 * 2. Keep real cached `thoughtSignature` values from `thoughtSignatureStore`, and only
 *    replace the synthetic `DEFAULT_THINKING_AG_SIGNATURE` fallback on uncached
 *    `functionCall` parts with the clean Vertex-native `DEFAULT_THINKING_VERTEX_SIGNATURE`.
 * 3. Strip `id` from `functionCall` and `functionResponse` (Vertex rejects these fields).
 */
function postProcessForVertex(body) {
  if (!body?.contents) return body;

  for (const turn of body.contents) {
    if (!Array.isArray(turn.parts)) continue;

    turn.parts = turn.parts.filter(
      (p) => !(p.thoughtSignature !== undefined && p.text === "" && !p.thought && !p.functionCall),
    );

    for (const part of turn.parts) {
      // Only replace the synthetic AG fallback signature; preserve real cached signatures!
      if (part.thoughtSignature === DEFAULT_THINKING_AG_SIGNATURE) {
        part.thoughtSignature = DEFAULT_THINKING_VERTEX_SIGNATURE;
      }
      // Strip id from functionCall
      if (part.functionCall && "id" in part.functionCall) {
        delete part.functionCall.id;
      }
      // Strip id from functionResponse
      if (part.functionResponse && "id" in part.functionResponse) {
        delete part.functionResponse.id;
      }
    }
  }

  return body;
}

export function openaiToVertexRequest(model, body, stream, credentials) {
  const gemini = openaiToGeminiRequest(model, body, stream, credentials);
  return postProcessForVertex(gemini);
}

register(FORMATS.OPENAI, FORMATS.VERTEX, openaiToVertexRequest, null);
