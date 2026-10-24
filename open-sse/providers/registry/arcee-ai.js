export default {
  id: "arcee-ai",
  alias: "arcee-ai",
  aliases: [
    "arcee"
  ],
  uiAlias: "arcee-ai",
  display: {
    name: "Arcee AI",
    icon: "auto_awesome",
    color: "#8B5CF6",
    textIcon: "AR",
    website: "https://arcee.ai",
    notice: {
      text: "Free Trinity Large Thinking model (262K context). No credit card required.",
      apiKeyUrl: "https://arcee.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.arcee.ai/api/v1/chat/completions"
  },
  models: [],
  passthroughModels: true
};
