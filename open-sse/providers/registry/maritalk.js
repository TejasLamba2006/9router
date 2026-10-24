export default {
  id: "maritalk",
  alias: "maritalk",
  uiAlias: "maritalk",
  display: {
    name: "Maritalk",
    icon: "translate",
    color: "#1D4ED8",
    textIcon: "MT",
    website: "https://www.maritaca.ai",
    notice: {
      apiKeyUrl: "https://www.maritaca.ai"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://chat.maritaca.ai/api",
    auth: {
      combined: true,
      header: "key",
      scheme: "raw"
    }
  },
  models: [
    { id: "sabia-4", name: "sabia-4" },
    { id: "sabia-4-thinking", name: "sabia-4-thinking" },
    { id: "sabiazinho-4", name: "sabiazinho-4" }
  ]
};
