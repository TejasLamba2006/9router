export default {
  id: "yolo-auto",
  alias: "yolo-auto",
  uiAlias: "yolo-auto",
  display: {
    name: "Yolo-Auto",
    icon: "auto_awesome",
    color: "#F59E0B",
    textIcon: "YA",
    website: "https://yolo-auto.com",
    notice: {
      text: "Free API access is request-limited and intended for testing; no numeric daily quota is published and free access is not promised indefinitely.",
      apiKeyUrl: "https://yolo-auto.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://yolo-auto.com/v1/chat/completions",
    validateUrl: "https://yolo-auto.com/v1/models"
  },
  models: [
    { id: "qwen3.6-35b-a3b", name: "Qwen 3.6 35B A3B" }
  ],
  modelsFetcher: {
    url: "https://yolo-auto.com/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
