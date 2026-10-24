export default {
  id: "dxnt",
  alias: "dxnt",
  uiAlias: "dxnt",
  display: {
    name: "DXNT / DX Token",
    icon: "hub",
    color: "#111827",
    textIcon: "DX",
    website: "https://www.dxnt.com",
    notice: {
      text: "Free accounts are documented at 100 calls/day; the quota may increase through invitations and can vary by account.",
      apiKeyUrl: "https://www.dxnt.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://www.dxnt.com/v1/chat/completions",
    validateUrl: "https://www.dxnt.com/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://www.dxnt.com/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
