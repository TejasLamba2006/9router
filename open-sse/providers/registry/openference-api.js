export default {
  id: "openference-api",
  alias: "openference-api",
  aliases: [
    "ofa"
  ],
  uiAlias: "openference-api",
  display: {
    name: "Openference API",
    icon: "openference",
    color: "#6366F1",
    textIcon: "OF",
    website: "https://openference.com",
    notice: {
      text: "Free tier: includes Qwen3.8 27b and Llama 3.2 3B, see openference.com/pricing for current terms",
      apiKeyUrl: "https://openference.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.openference.com/v1/chat/completions"
  },
  models: [
    { id: "GLM-5.2", name: "GLM 5.2", contextLength: 850000 },
    { id: "Qwen3.8 27b", name: "Qwen3.8 27B", contextLength: 262144 },
    { id: "Llama 3.2 3B", name: "Llama 3.2 3B", contextLength: 131072 }
  ],
  passthroughModels: true
};
