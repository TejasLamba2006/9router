export default {
  id: "upstage",
  alias: "upstage",
  uiAlias: "upstage",
  display: {
    name: "Upstage",
    icon: "trending_up",
    color: "#0F766E",
    textIcon: "UP",
    website: "https://www.upstage.ai",
    notice: {
      apiKeyUrl: "https://www.upstage.ai"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.upstage.ai/v1/chat/completions"
  },
  models: [
    { id: "solar-pro3", name: "solar-pro3" },
    { id: "solar-mini", name: "solar-mini" }
  ]
};
