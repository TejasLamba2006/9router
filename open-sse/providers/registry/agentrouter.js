export default {
  id: "agentrouter",
  alias: "agentrouter",
  uiAlias: "agentrouter",
  display: {
    name: "AgentRouter",
    icon: "router",
    color: "#10B981",
    textIcon: "AR",
    website: "https://agentrouter.org",
    notice: {
      text: "$200 free credits on signup - multi-model routing gateway",
      apiKeyUrl: "https://agentrouter.org"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://agentrouter.org/v1/chat/completions",
    validateUrl: "https://agentrouter.org/v1/models"
  },
  models: [
    { id: "claude-opus-4-8", name: "Claude Opus 4.8" },
    { id: "claude-opus-5", name: "Claude Opus 5" },
    { id: "gpt-5.6-sol", name: "GPT-5.6 Sol" }
  ],
  modelsFetcher: {
    url: "https://agentrouter.org/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
