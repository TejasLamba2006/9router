export default {
  id: "meta-llama",
  alias: "meta-llama",
  aliases: [
    "meta"
  ],
  uiAlias: "meta-llama",
  display: {
    name: "Meta Llama API",
    icon: "smart_toy",
    color: "#0F766E",
    textIcon: "ML",
    website: "https://llama.developer.meta.com",
    notice: {
      apiKeyUrl: "https://llama.developer.meta.com"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.llama.com/compat/v1/chat/completions"
  },
  models: [
    { id: "Llama-4-Maverick-17B-128E-Instruct-FP8", name: "Llama-4-Maverick-17B-128E-Instruct-FP8" },
    { id: "Llama-4-Scout-17B-16E-Instruct-FP8", name: "Llama-4-Scout-17B-16E-Instruct-FP8" },
    { id: "Llama-3.3-70B-Instruct", name: "Llama-3.3-70B-Instruct" },
    { id: "Llama-3.3-8B-Instruct", name: "Llama-3.3-8B-Instruct" }
  ]
};
