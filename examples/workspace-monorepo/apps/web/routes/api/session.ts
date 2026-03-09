import { createAuth, createMemorySessionStore } from "gorsee/auth"
import type { Context } from "gorsee/server"
import { describeWorkspace } from "@example/shared"

const auth = createAuth({ secret: "workspace-secret", store: createMemorySessionStore() })

export function GET(_ctx: Context): Response {
  return Response.json({
    workspace: describeWorkspace(),
    authReady: typeof auth.middleware === "function",
  })
}
