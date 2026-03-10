export default {
  app: {
    mode: "server" as const,
  },

  runtime: {
    topology: "single-instance" as const,
  },

  security: {
    origin: process.env.APP_ORIGIN ?? "http://localhost:3000",
    rateLimit: {
      maxRequests: 100,
      window: "1m",
    },
  },
}
