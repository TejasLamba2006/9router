export default {
  id: "nlpcloud",
  alias: "nlpcloud",
  aliases: [
    "nlpc"
  ],
  uiAlias: "nlpcloud",
  display: {
    name: "NLP Cloud",
    icon: "psychology",
    color: "#2196F3",
    textIcon: "NLPC",
    website: "https://docs.nlpcloud.com",
    notice: {
      text: "Trial credits for new accounts",
      apiKeyUrl: "https://docs.nlpcloud.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.nlpcloud.io/v1/gpu"
  },
  models: [
    { id: "chatdolphin", name: "ChatDolphin", contextLength: 8192 },
    { id: "dolphin", name: "Dolphin", contextLength: 16384 },
    { id: "finetuned-llama-3-70b", name: "Fine-tuned LLaMA 3.3 70B" },
    { id: "llama-3-1-405b", name: "LLaMA 3.1 405B" },
    { id: "llama-3-8b-instruct", name: "Llama 3 8B" }
  ]
};
