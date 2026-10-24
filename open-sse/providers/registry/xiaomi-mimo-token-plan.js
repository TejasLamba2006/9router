export default {
  id: "xiaomi-mimo-token-plan",
  alias: "xiaomi-mimo-token-plan",
  aliases: [
    "mimotp"
  ],
  uiAlias: "xiaomi-mimo-token-plan",
  display: {
    name: "Xiaomi MiMo Token Plan",
    icon: "devices",
    color: "#EA580C",
    textIcon: "MT",
    website: "https://mimo.mi.com",
    notice: {
      apiKeyUrl: "https://mimo.mi.com"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://token-plan-sgp.xiaomimimo.com/v1"
  },
  models: [
    { id: "mimo-v2.5-pro", name: "MiMo-V2.5-Pro", contextLength: 1048576 },
    { id: "mimo-v2.5", name: "MiMo-V2.5", contextLength: 1048576 }
  ]
};
