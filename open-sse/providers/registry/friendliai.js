export default {
  id: "friendliai",
  alias: "friendliai",
  aliases: [
    "friendli"
  ],
  uiAlias: "friendliai",
  display: {
    name: "FriendliAI",
    icon: "handshake",
    color: "#EC4899",
    textIcon: "FR",
    website: "https://friendli.ai",
    notice: {
      text: "Free tier for serverless inference, no credit card required",
      apiKeyUrl: "https://friendli.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.friendli.ai/serverless/v1/chat/completions",
    validateUrl: "https://api.friendli.ai/serverless/v1/models"
  },
  models: [
    { id: "meta-llama-3.1-70b-instruct", name: "meta-llama-3.1-70b-instruct" },
    { id: "meta-llama-3.1-8b-instruct", name: "meta-llama-3.1-8b-instruct" }
  ],
  modelsFetcher: {
    url: "https://api.friendli.ai/serverless/v1/models",
    type: "openai"
  }
};
