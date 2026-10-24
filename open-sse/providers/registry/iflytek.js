export default {
  id: "iflytek",
  alias: "iflytek",
  uiAlias: "iflytek",
  display: {
    name: "iFlytek Spark",
    icon: "auto_awesome",
    color: "#0066FF",
    textIcon: "IF",
    website: "https://xinghuo.xfyun.cn",
    notice: {
      text: "Spark Lite is free (2 QPS rate-limited), but iFlytek ToS §2.4(3) prohibits programmatic extraction and requires Chinese real-name auth, use with caution.",
      apiKeyUrl: "https://xinghuo.xfyun.cn"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://spark-api-open.xf-yun.com/v1/chat/completions"
  },
  models: [
    { id: "4.0Ultra", name: "Spark 4.0 Ultra", contextLength: 32768 },
    { id: "generalv3.5", name: "Spark Max (V3.5)" },
    { id: "max-32k", name: "Spark Max 32K", contextLength: 32768 },
    { id: "generalv3", name: "Spark Pro", contextLength: 8192 },
    { id: "pro-128k", name: "Spark Pro 128K", contextLength: 131072 },
    { id: "lite", name: "Spark Lite", contextLength: 4096 }
  ]
};
