export default {
  id: "aimlapi",
  alias: "aimlapi",
  aliases: [
    "aiml"
  ],
  uiAlias: "aimlapi",
  display: {
    name: "AI/ML API",
    icon: "hub",
    color: "#6366F1",
    textIcon: "AI",
    website: "https://aimlapi.com",
    notice: {
      text: "Free tier paused (2026), AI/ML API is now pay-as-you-go only (min $20 top-up); no recurring free credits.",
      apiKeyUrl: "https://aimlapi.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.aimlapi.com/v1/chat/completions"
  },
  models: [
    { id: "gpt-4o", name: "GPT-4o (via AI/ML API)" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (via AI/ML API)" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (via AI/ML API)" },
    { id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", name: "Llama 3.1 70B (via AI/ML API)" },
    { id: "deepseek-chat", name: "DeepSeek Chat (via AI/ML API)" },
    { id: "mistral-large-latest", name: "Mistral Large (via AI/ML API)" }
  ],
  passthroughModels: true
};
