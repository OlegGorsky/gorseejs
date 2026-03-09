import { createAuth, createMemorySessionStore } from "gorsee/auth"

const store = createMemorySessionStore()

export const auth = createAuth({
  secret: "replace-me-in-production",
  store,
})
