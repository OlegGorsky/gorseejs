import type { MiddlewareFn } from "gorsee/server"
import { createPluginRunner, definePlugin } from "gorsee/plugins"

const tenantRuntimeMiddleware: MiddlewareFn = async (ctx, next) => {
  ctx.setHeader("X-Gorsee-Plugin-Stack", "plugin-stack-ready")
  ctx.locals.pluginStack = "tenant-runtime"
  return next()
}

const tenantRuntimePlugin = definePlugin({
  name: "tenant-runtime",
  capabilities: ["middleware", "runtime"],
  middleware: tenantRuntimeMiddleware,
  lifecycle: {
    runtime: async (app) => {
      app.addRoute("/_plugin/runtime-health", async (ctx) => Response.json({
        service: "gorsee-plugin-stack",
        plugin: app.plugin.name,
        phase: app.phase,
        ready: app.config["plugin-stack-ready"] === true,
        current: String(ctx.locals.pluginStack ?? "none"),
      }))
    },
  },
})

const auditTrailPlugin = definePlugin({
  name: "audit-trail",
  dependsOn: ["tenant-runtime"],
  capabilities: ["runtime"],
  lifecycle: {
    runtime: async (app) => {
      app.config.auditTrail = `${app.plugin.name}:${app.phase}`
    },
  },
})

export async function describePluginStack() {
  const runner = createPluginRunner({ "plugin-stack-ready": true })
  runner.register(tenantRuntimePlugin)
  runner.register(auditTrailPlugin)
  await runner.setupAll()

  const summary = {
    descriptors: runner.getPluginDescriptors(),
    capabilities: runner.getCapabilities(),
    routes: [...runner.getRoutes().keys()],
  }

  await runner.teardownAll()
  return summary
}
