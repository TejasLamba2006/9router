export default {
  id: "yi",
  alias: "yi",
  uiAlias: "yi",
  display: {
    name: "Yi (01.AI)",
    icon: "auto_awesome",
    color: "#10B981",
    textIcon: "YI",
    website: "https://01.ai",
    notice: {
      text: "No free API tier (2026), Yi-Light retired; platform.01.ai is pay-as-you-go (Yi-Lightning paid). Open weights are download-only.",
      apiKeyUrl: "https://01.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.lingyiwanwu.com/v1/chat/completions"
  },
  models: [
    { id: "yi-large", name: "Yi Large" }
  ]
};
