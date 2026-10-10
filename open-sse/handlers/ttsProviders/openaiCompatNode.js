import { Buffer } from "node:buffer";
import { customNodeMediaUrl } from "../customMediaNode.js";

export default function createOpenAICompatibleNodeTtsAdapter(provider) {
  return {
    async synthesize(text, model, credentials, responseFormat = "mp3") {
      const url = customNodeMediaUrl(provider, credentials, "tts", "audio/speech");
      const [ttsModel = "tts-1", voice = "alloy"] = String(model || "tts-1/alloy").split("/");
      const key = credentials?.apiKey || credentials?.accessToken;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify({ model: ttsModel, voice, input: text, response_format: responseFormat }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Custom TTS failed: ${res.status}`);
      }
      return { base64: Buffer.from(await res.arrayBuffer()).toString("base64"), format: responseFormat };
    },
  };
}
