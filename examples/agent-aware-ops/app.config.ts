export default {
  ai: {
    enabled: true,
    jsonlPath: ".gorsee/ai-events.jsonl",
    diagnosticsPath: ".gorsee/ai-diagnostics.json",
    sessionPack: {
      enabled: true,
      outDir: ".gorsee/agent",
      triggerKinds: ["diagnostic.issue", "request.error", "build.summary", "check.summary"],
    },
    bridge: {
      url: "http://127.0.0.1:4318/gorsee/ai-events",
      timeoutMs: 250,
      events: ["diagnostic.issue", "request.error", "build.summary"],
    },
  },
  security: {
    origin: "https://ops.example.com",
  },
}
