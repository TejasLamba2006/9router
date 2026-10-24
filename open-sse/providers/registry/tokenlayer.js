export default {
  id: "tokenlayer",
  alias: "tokenlayer",
  uiAlias: "tokenlayer",
  display: {
    name: "tokenlayer",
    icon: "hub",
    color: "#6366F1",
    textIcon: "TO",
    notice: {}
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.tokenlayer.net/v1/chat/completions",
    validateUrl: "https://api.tokenlayer.net/v1/models"
  },
  models: [
    { id: "deepseek-v3.2", name: "deepseek-v3.2" },
    { id: "claude-fable-5-1", name: "claude-fable-5-1" },
    { id: "claude-opus-4-7", name: "claude-opus-4-7" },
    { id: "claude-sonnet-4-6", name: "claude-sonnet-4-6" },
    { id: "groq/compound-mini", name: "groq/compound-mini" },
    { id: "gpt-6-astra", name: "gpt-6-astra" },
    { id: "claude-opus-4-6", name: "claude-opus-4-6" },
    { id: "gpt-5.5", name: "gpt-5.5" },
    { id: "claude-opus-4-8", name: "claude-opus-4-8" },
    { id: "groq/compound", name: "groq/compound" },
    { id: "llama-3.1-8b-instant", name: "llama-3.1-8b-instant" },
    { id: "gpt-5.6-terra", name: "gpt-5.6-terra" },
    { id: "gpt-5.6-luna", name: "gpt-5.6-luna" },
    { id: "claude-fable-5", name: "claude-fable-5" },
    { id: "claude-sonnet-5", name: "claude-sonnet-5" },
    { id: "openai/gpt-oss-120b", name: "openai/gpt-oss-120b" },
    { id: "gpt-5.6-sol", name: "gpt-5.6-sol" },
    { id: "deepseek-v3.1", name: "deepseek-v3.1" },
    { id: "claude-opus-4.6", name: "claude-opus-4.6" },
    { id: "claude-opus-5", name: "claude-opus-5" },
    { id: "gpt-5.5-pro", name: "gpt-5.5-pro" },
    { id: "claude-opus-4-7-low", name: "claude-opus-4-7-low" }
  ],
  modelsFetcher: {
    url: "https://api.tokenlayer.net/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
