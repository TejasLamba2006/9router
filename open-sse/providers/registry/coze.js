export default {
  id: "coze",
  alias: "coze",
  uiAlias: "coze",
  display: {
    name: "Coze",
    icon: "smart_toy",
    color: "#3B82F6",
    textIcon: "CZ",
    website: "https://coze.com",
    notice: {
      text: "Free ByteDance agent platform. Bot building + LLM access.",
      apiKeyUrl: "https://coze.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.coze.com/v1/chat/completions"
  },
  models: [
    { id: "claude-3-7-sonnet-20250514", name: "Claude 3.7 Sonnet" }
  ]
};
