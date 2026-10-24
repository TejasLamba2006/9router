import { CLAUDE_API_HEADERS } from "../shared.js";

export default {
  id: "kimi-coding-apikey",
  alias: "kimi-coding-apikey",
  aliases: [
    "kmca"
  ],
  uiAlias: "kimi-coding-apikey",
  display: {
    name: "Kimi Code API Key",
    icon: "psychology",
    color: "#1E40AF",
    textIcon: "KC",
    website: "https://www.kimi.ai/code?aff=omniroute",
    notice: {
      apiKeyUrl: "https://www.kimi.ai/code?aff=omniroute"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.kimi.com/coding/v1/messages?beta=true",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS },
    auth: {
      combined: true,
      header: "x-api-key",
      scheme: "raw"
    }
  },
  models: [
    { id: "k3", name: "Kimi K3", contextLength: 1048576 },
    { id: "kimi-for-coding", name: "Kimi K2.8 Preview", contextLength: 1048576 },
    { id: "kimi-for-coding-highspeed", name: "Kimi K2.8 Preview (High Speed)", contextLength: 1048576 }
  ]
};
