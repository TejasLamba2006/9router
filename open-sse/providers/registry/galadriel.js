export default {
  id: "galadriel",
  alias: "galadriel",
  uiAlias: "galadriel",
  display: {
    name: "Galadriel",
    icon: "auto_awesome",
    color: "#F59E0B",
    textIcon: "GA",
    website: "https://galadriel.com",
    notice: {
      apiKeyUrl: "https://galadriel.com"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.galadriel.ai/v1/chat/completions"
  },
  models: [
    { id: "galadriel-latest", name: "galadriel-latest" }
  ]
};
