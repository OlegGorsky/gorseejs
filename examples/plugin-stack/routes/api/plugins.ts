import type { Context } from "gorsee/server"
import { describePluginStack } from "../../shared/plugin-stack"

export async function GET(_ctx: Context) {
  const stack = await describePluginStack()
  return Response.json({
    service: "gorsee-plugin-stack",
    readiness: "plugin-stack-ready",
    ...stack,
  })
}
