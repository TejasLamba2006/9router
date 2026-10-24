import { CLAUDE_API_HEADERS } from "../shared.js";

export default {
  id: "zai",
  alias: "zai",
  uiAlias: "zai",
  display: {
    name: "Z.AI",
    icon: "psychology",
    color: "#2563EB",
    textIcon: "ZA",
    website: "https://open.bigmodel.cn",
    notice: {
      apiKeyUrl: "https://open.bigmodel.cn"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.z.ai/api/anthropic/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS },
    auth: {
      combined: true,
      header: "x-api-key",
      scheme: "raw"
    },
    urlSuffix: "?beta=true"
  },
  models: [
    { id: "glm-5.3", name: "GLM 5.3", contextLength: 1000000 },
    { id: "glm-5.3-flash", name: "GLM 5.3 Flash", contextLength: 1000000 },
    { id: "glm-5.2", name: "GLM 5.2" },
    { id: "glm-5.1", name: "GLM 5.1" },
    { id: "glm-5", name: "GLM 5" },
    { id: "glm-5-turbo", name: "GLM 5 Turbo" },
    { id: "glm-4.7-flash", name: "GLM 4.7 Flash" },
    { id: "glm-4.7", name: "GLM 4.7" }
  ]
};
