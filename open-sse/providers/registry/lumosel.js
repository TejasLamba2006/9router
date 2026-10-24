import { CLAUDE_API_HEADERS } from "../shared.js";

export default {
  id: "lumosel",
  alias: "lumosel",
  uiAlias: "lumosel",
  display: {
    name: "lumosel",
    icon: "hub",
    color: "#6366F1",
    textIcon: "LU",
    notice: {}
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.lumosel.vip/v1/messages",
    validateUrl: "https://api.lumosel.vip/v1/models",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS },
    auth: {
      combined: true,
      header: "x-api-key",
      scheme: "raw"
    }
  },
  models: [],
  modelsFetcher: {
    url: "https://api.lumosel.vip/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
