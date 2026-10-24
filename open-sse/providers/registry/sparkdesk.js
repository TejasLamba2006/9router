export default {
  id: "sparkdesk",
  alias: "sparkdesk",
  uiAlias: "sparkdesk",
  display: {
    name: "SparkDesk",
    icon: "auto_awesome",
    color: "#0066FF",
    textIcon: "SD",
    website: "https://xinghuo.xfyun.cn",
    notice: {
      text: "Spark Lite free (alias for iflytek), but ToS restricts to personal/non-commercial use and prohibits relaying access to third parties, use with caution.",
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
    { id: "generalv3", name: "Spark Pro", contextLength: 8192 },
    { id: "pro-128k", name: "Spark Pro 128K", contextLength: 131072 },
    { id: "lite", name: "Spark Lite", contextLength: 4096 }
  ]
};
