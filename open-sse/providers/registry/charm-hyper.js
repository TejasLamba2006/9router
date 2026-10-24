export default {
  id: "charm-hyper",
  alias: "charm-hyper",
  uiAlias: "charm-hyper",
  display: {
    name: "Charm Hyper",
    icon: "router",
    color: "#7C3AED",
    textIcon: "CH",
    website: "https://hyper.charm.land",
    notice: {
      text: "100 free monthly Hypercredits on signup",
      apiKeyUrl: "https://hyper.charm.land"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://hyper.charm.land/v1/chat/completions",
    validateUrl: "https://hyper.charm.land/v1/models"
  },
  models: [
    { id: "hyper/auto", name: "Charm Hyper Auto" }
  ],
  modelsFetcher: {
    url: "https://hyper.charm.land/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
