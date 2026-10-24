export default {
  id: "cloudcode-one",
  alias: "cloudcode-one",
  uiAlias: "cloudcode-one",
  display: {
    name: "CloudCode.ONE",
    icon: "router",
    color: "#6366F1",
    textIcon: "CC",
    website: "https://cloudcode.one",
    notice: {
      text: "Published free models include glm-4.7-flash and glm-4.6v-flash; no numeric quota is published, and key creation may require credit or a coupon.",
      apiKeyUrl: "https://cloudcode.one"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.cloudcode.one/v1/chat/completions",
    validateUrl: "https://api.cloudcode.one/v1/models"
  },
  models: [
    { id: "glm-4.7-flash", name: "GLM 4.7 Flash" },
    { id: "glm-4.6v-flash", name: "GLM 4.6V Flash" }
  ],
  modelsFetcher: {
    url: "https://api.cloudcode.one/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
