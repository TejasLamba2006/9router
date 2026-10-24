export default {
  id: "freetheai",
  alias: "freetheai",
  aliases: [
    "fta"
  ],
  uiAlias: "freetheai",
  display: {
    name: "FreeTheAi",
    icon: "hub",
    color: "#22C55E",
    textIcon: "FTA",
    website: "https://freetheai.xyz",
    notice: {
      text: "Free OpenAI-compatible gateway, sign up via Discord for an API key.",
      apiKeyUrl: "https://freetheai.xyz"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.freetheai.xyz/v1/chat/completions",
    validateUrl: "https://api.freetheai.xyz/v1/models"
  },
  models: [
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "llama-3.3-70b-instruct", name: "Llama 3.3 70B" },
    { id: "deepseek-chat", name: "DeepSeek Chat" }
  ],
  modelsFetcher: {
    url: "https://api.freetheai.xyz/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
