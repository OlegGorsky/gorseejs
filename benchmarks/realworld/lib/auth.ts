import { createAuth } from "gorsee/server"
import config from "../app.config.ts"

export const auth = createAuth(config.auth)

export type Session = {
  id: string
  userId: string
  data: Record<string, unknown>
  expiresAt: number
}

export function currentUserId(ctx: { locals: Record<string, unknown> }): number | null {
  const session = ctx.locals.session as Session | undefined
  return session ? Number(session.userId) : null
}
