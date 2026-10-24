export default {
  id: "liquid",
  alias: "liquid",
  uiAlias: "liquid",
  display: {
    name: "Liquid AI",
    icon: "water_drop",
    color: "#06B6D4",
    textIcon: "LQ",
    website: "https://liquid.ai",
    notice: {
      text: "Free LFM2.5-1.2B-Thinking and LFM2.5-1.2B-Instruct models. MIT spinoff, hybrid architecture.",
      apiKeyUrl: "https://liquid.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://inference.liquid.ai/v1/chat/completions",
    validateUrl: "https://inference.liquid.ai/v1/models"
  },
  models: [
    { id: "liquid-lfm-40b", name: "Liquid LFM 40B" }
  ],
  modelsFetcher: {
    url: "https://inference.liquid.ai/v1/models",
    type: "openai"
  }
};
