export default {
  auth: {
    secret: "realworld-benchmark-secret-change-in-production",
    cookieName: "conduit_session",
    maxAge: 86400 * 7,
    loginPath: "/login",
  },
  db: {
    path: "./realworld.db",
  },
  server: {
    port: 3000,
  },
}
