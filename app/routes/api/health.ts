import type { Context } from "gorsee/server"

export function GET(_ctx: Context): Response {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  })
}
