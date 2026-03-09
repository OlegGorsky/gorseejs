import { auth } from "./auth-shared"

export default {
  security: {
    origin: "https://saas.example.com",
    rpc: {
      middlewares: [auth.protect()],
    },
  },
}
