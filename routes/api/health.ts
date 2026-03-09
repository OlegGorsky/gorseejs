import type { Context } from "gorsee/server"

export function GET(_ctx: Context): Response {
  return new Response(
    JSON.stringify({
      status: "ok",
      framework: "gorsee",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  )
}
