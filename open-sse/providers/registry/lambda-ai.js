export default {
  id: "lambda-ai",
  alias: "lambda-ai",
  aliases: [
    "lambda"
  ],
  uiAlias: "lambda-ai",
  display: {
    name: "Lambda AI",
    icon: "bolt",
    color: "#7C3AED",
    textIcon: "LA",
    website: "https://lambda.ai",
    notice: {
      apiKeyUrl: "https://lambda.ai"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.lambda.ai/v1/chat/completions"
  },
  models: [
    { id: "deepseek-r1-671b", name: "deepseek-r1-671b" },
    { id: "llama3.3-70b-instruct-fp8", name: "llama3.3-70b-instruct-fp8" },
    { id: "qwen25-coder-32b-instruct", name: "qwen25-coder-32b-instruct" }
  ]
};
