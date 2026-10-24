export default {
  id: "reka",
  alias: "reka",
  uiAlias: "reka",
  display: {
    name: "Reka",
    icon: "auto_awesome",
    color: "#111827",
    textIcon: "RK",
    website: "https://docs.reka.ai/chat/overview",
    notice: {
      text: "$10/month recurring free API credits",
      apiKeyUrl: "https://docs.reka.ai/chat/overview"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.reka.ai/v1/chat/completions"
  },
  models: [
    { id: "reka-flash-3", name: "Reka Flash 3" },
    { id: "reka-flash", name: "Reka Flash" },
    { id: "reka-edge-2603", name: "Reka Edge 2603" }
  ]
};
