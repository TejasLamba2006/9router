export default {
  id: "routeway",
  alias: "routeway",
  uiAlias: "routeway",
  display: {
    name: "Routeway",
    icon: "hub",
    color: "#F59E0B",
    textIcon: "RW",
    website: "https://routeway.ai",
    notice: {
      text: "Free models (:free suffix) at ~5 RPM / 200 RPD across Llama, Nemotron, Step and Laguna.",
      apiKeyUrl: "https://routeway.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.routeway.ai/v1/chat/completions",
    validateUrl: "https://api.routeway.ai/v1/models"
  },
  models: [
    { id: "llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Instruct (free)", contextLength: 131072 },
    { id: "nemotron-3-nano-30b-a3b:free", name: "Nemotron 3 Nano 30B (free)", contextLength: 256000 },
    { id: "nemotron-nano-9b-v2:free", name: "Nemotron Nano 9B v2 (free)", contextLength: 128000 },
    { id: "step-3.7-flash:free", name: "Step 3.7 Flash (free)", contextLength: 256000 },
    { id: "step-3.5-flash:free", name: "Step 3.5 Flash (free)", contextLength: 65536 },
    { id: "laguna-m.1:free", name: "Laguna M.1 (free)", contextLength: 131072 },
    { id: "laguna-xs.2:free", name: "Laguna XS.2 (free)", contextLength: 131072 },
    { id: "llama-3.2-3b-instruct:free", name: "Llama 3.2 3B Instruct (free)", contextLength: 16000 }
  ],
  modelsFetcher: {
    url: "https://api.routeway.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
