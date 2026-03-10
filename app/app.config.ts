export default {
  app: {
    mode: "fullstack" as const,
  },

  port: 3000,

  db: {
    driver: "sqlite" as const,
    url: "./data.sqlite",
  },

  log: "info" as const,

  ai: {
    enabled: false,
    // Writes structured events for AI agents and IDE tooling.
    jsonlPath: ".gorsee/ai-events.jsonl",
    diagnosticsPath: ".gorsee/ai-diagnostics.json",
    sessionPack: {
      enabled: true,
      outDir: ".gorsee/agent",
      triggerKinds: ["diagnostic.issue", "request.error", "build.summary", "check.summary"],
    },
    bridge: {
      // Point this at a local IDE bridge or MCP helper when you want live diagnostics.
      url: "http://127.0.0.1:4318/gorsee/ai-events",
      timeoutMs: 250,
      events: ["diagnostic.issue", "check.summary", "build.summary", "request.error"],
    },
  },

  security: {
    // Canonical application origin used for redirect and origin-sensitive checks.
    origin: process.env.APP_ORIGIN ?? "http://localhost:3000",
    proxy: {
      // Use "vercel", "netlify", "fly", or "reverse-proxy" when deployed behind a trusted proxy hop.
      preset: "none" as const,
      trustForwardedHeaders: false,
      trustedForwardedHops: 1,
    },
    csp: true,
    hsts: true,
    csrf: true,
    rateLimit: {
      maxRequests: 100,
      window: "1m",
    },
    rpc: {
      // Add auth/CSRF middleware here when server() calls need protection.
      // Example:
      // middlewares: [auth.middleware, auth.requireAuth, createCSRFMiddleware(process.env.SESSION_SECRET!)],
      middlewares: [],
    },
  },

  deploy: {
    target: "bun" as const,
  },
}
