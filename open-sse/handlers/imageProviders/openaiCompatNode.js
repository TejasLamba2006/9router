import createOpenAIAdapter from "./openai.js";
import { customNodeMediaUrl } from "../customMediaNode.js";

export default function createOpenAICompatibleNodeImageAdapter(provider) {
  return {
    ...createOpenAIAdapter("openai"),
    buildUrl: (_model, credentials) => customNodeMediaUrl(
      provider,
      credentials,
      "image",
      "images/generations"
    ),
  };
}
