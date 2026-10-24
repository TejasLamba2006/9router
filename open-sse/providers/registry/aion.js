export default {
  id: "aion",
  alias: "aion",
  uiAlias: "aion",
  display: {
    name: "Aion Labs",
    icon: "hub",
    color: "#0EA5E9",
    textIcon: "AI",
    website: "https://www.aionlabs.ai",
    notice: {
      text: "Free tier ~20k tokens/day across the Aion reasoning models.",
      apiKeyUrl: "https://www.aionlabs.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.aionlabs.ai/v1/chat/completions",
    validateUrl: "https://api.aionlabs.ai/v1/models"
  },
  models: [
    { id: "aion-labs/aion-3.0", name: "Aion 3.0", contextLength: 131072 },
    { id: "aion-labs/aion-3.0-mini", name: "Aion 3.0 Mini", contextLength: 131072 },
    { id: "aion-labs/aion-2.5", name: "Aion 2.5", contextLength: 131072 },
    { id: "aion-labs/aion-2.0", name: "Aion 2.0", contextLength: 131072 },
    { id: "aion-labs/aion-rp-llama-3.1-8b", name: "Aion RP Llama 3.1 8B", contextLength: 32768 },
    { id: "aion-labs/aion-3.5", name: "aion-labs/aion-3.5" },
    { id: "aion-labs/aion-3.5-mini", name: "aion-labs/aion-3.5-mini" }
  ],
  modelsFetcher: {
    url: "https://api.aionlabs.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
