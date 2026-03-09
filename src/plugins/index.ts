import type { MiddlewareFn, Context } from "../server/middleware.ts"
import type { BuildRuntimeTarget, FrameworkBuildPlugin } from "../build/plugin.ts"
export {
  defineBuildPlugin,
  resolveBuildPluginsForTarget,
  type BuildRuntimeTarget,
  type FrameworkBuildPlugin,
} from "../build/plugin.ts"

export type PluginPhase = "runtime" | "dev" | "build" | "test"
export type PluginCapability =
  | "middleware"
  | "routes"
  | "build"
  | "runtime"
  | "dev"
  | "test"
  | "auth"
  | "db"
  | "storage"
  | "payments"
  | "email"
  | "styling"

export interface PluginConfigValidationIssue {
  path: string
  message: string
}

export interface PluginLifecycleContext extends PluginContext {
  phase: PluginPhase
  plugin: PluginDescriptor
}

export interface PluginLifecycle {
  runtime?: (app: PluginLifecycleContext) => void | Promise<void>
  dev?: (app: PluginLifecycleContext) => void | Promise<void>
  build?: (app: PluginLifecycleContext) => void | Promise<void>
  test?: (app: PluginLifecycleContext) => void | Promise<void>
}

export interface GorseePlugin {
  name: string
  version?: string
  capabilities?: PluginCapability[]
  dependsOn?: string[]
  order?: {
    before?: string[]
    after?: string[]
  }
  configSchema?: (config: Record<string, unknown>) => PluginConfigValidationIssue[] | void
  setup?: (app: PluginContext) => void | Promise<void>
  middleware?: MiddlewareFn
  buildPlugins?: () => FrameworkBuildPlugin[]
  teardown?: () => void | Promise<void>
  lifecycle?: PluginLifecycle
}

export interface PluginDescriptor {
  name: string
  version?: string
  capabilities: PluginCapability[]
  dependsOn: string[]
  before: string[]
  after: string[]
}

export interface PluginContext {
  addMiddleware(mw: MiddlewareFn): void
  addRoute(path: string, handler: (ctx: Context) => Promise<Response>): void
  config: Record<string, unknown>
  getConfig?<T extends Record<string, unknown> = Record<string, unknown>>(): T
}

export function definePlugin<T extends GorseePlugin>(plugin: T): T {
  return plugin
}

export interface PluginRunner {
  register(plugin: GorseePlugin): void
  setupAll(): Promise<void>
  runPhase(phase: PluginPhase): Promise<void>
  teardownAll(): Promise<void>
  getMiddlewares(): MiddlewareFn[]
  getBuildPlugins(target?: BuildRuntimeTarget): FrameworkBuildPlugin[]
  getRoutes(): Map<string, (ctx: Context) => Promise<Response>>
  getPluginDescriptors(): PluginDescriptor[]
  getCapabilities(): PluginCapability[]
}

function normalizeCapabilities(plugin: GorseePlugin): PluginCapability[] {
  const capabilities = new Set<PluginCapability>(plugin.capabilities ?? [])
  if (plugin.middleware) capabilities.add("middleware")
  if (plugin.buildPlugins) capabilities.add("build")
  if (plugin.lifecycle?.build) capabilities.add("build")
  if (plugin.lifecycle?.dev) capabilities.add("dev")
  if (plugin.lifecycle?.runtime || plugin.setup) capabilities.add("runtime")
  if (plugin.lifecycle?.test) capabilities.add("test")
  return [...capabilities].sort()
}

function describePlugin(plugin: GorseePlugin): PluginDescriptor {
  return {
    name: plugin.name,
    version: plugin.version,
    capabilities: normalizeCapabilities(plugin),
    dependsOn: [...(plugin.dependsOn ?? [])],
    before: [...(plugin.order?.before ?? [])],
    after: [...(plugin.order?.after ?? [])],
  }
}

function validatePluginConfig(plugin: GorseePlugin, config: Record<string, unknown>): void {
  const issues = plugin.configSchema?.(config) ?? []
  if (!issues.length) return
  const rendered = issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
  throw new Error(`Plugin "${plugin.name}" config validation failed: ${rendered}`)
}

function sortPlugins(plugins: GorseePlugin[]): GorseePlugin[] {
  const byName = new Map(plugins.map((plugin) => [plugin.name, plugin]))
  const edges = new Map<string, Set<string>>()
  const incoming = new Map<string, number>()

  for (const plugin of plugins) {
    edges.set(plugin.name, new Set())
    incoming.set(plugin.name, 0)
  }

  function addEdge(from: string, to: string): void {
    if (!byName.has(from) || !byName.has(to) || from === to) return
    const targets = edges.get(from)!
    if (targets.has(to)) return
    targets.add(to)
    incoming.set(to, (incoming.get(to) ?? 0) + 1)
  }

  for (const plugin of plugins) {
    for (const dependency of plugin.dependsOn ?? []) {
      if (!byName.has(dependency)) {
        throw new Error(`Plugin "${plugin.name}" depends on missing plugin "${dependency}"`)
      }
      addEdge(dependency, plugin.name)
    }
    for (const after of plugin.order?.after ?? []) {
      if (!byName.has(after)) {
        throw new Error(`Plugin "${plugin.name}" declares unknown order.after target "${after}"`)
      }
      addEdge(after, plugin.name)
    }
    for (const before of plugin.order?.before ?? []) {
      if (!byName.has(before)) {
        throw new Error(`Plugin "${plugin.name}" declares unknown order.before target "${before}"`)
      }
      addEdge(plugin.name, before)
    }
  }

  const queue = [...plugins]
    .filter((plugin) => (incoming.get(plugin.name) ?? 0) === 0)
    .sort((left, right) => left.name.localeCompare(right.name))
  const ordered: GorseePlugin[] = []

  while (queue.length > 0) {
    const plugin = queue.shift()!
    ordered.push(plugin)
    for (const target of edges.get(plugin.name) ?? []) {
      incoming.set(target, (incoming.get(target) ?? 1) - 1)
      if ((incoming.get(target) ?? 0) === 0) {
        queue.push(byName.get(target)!)
        queue.sort((left, right) => left.name.localeCompare(right.name))
      }
    }
  }

  if (ordered.length !== plugins.length) {
    throw new Error("Plugin ordering contains a cycle.")
  }

  return ordered
}

export function createPluginRunner(
  config: Record<string, unknown> = {},
): PluginRunner {
  const plugins: GorseePlugin[] = []
  const middlewares: MiddlewareFn[] = []
  const routes = new Map<string, (ctx: Context) => Promise<Response>>()

  const pluginCtx: PluginContext = {
    addMiddleware: (mw) => middlewares.push(mw),
    addRoute: (path, handler) => routes.set(path, handler),
    config,
    getConfig<T extends Record<string, unknown>>() {
      return config as T
    },
  }

  async function runPluginPhase(plugin: GorseePlugin, phase: PluginPhase): Promise<void> {
    const descriptor = describePlugin(plugin)
    const ctx: PluginLifecycleContext = { ...pluginCtx, phase, plugin: descriptor }

    if (phase === "runtime" && plugin.setup) {
      await plugin.setup(pluginCtx)
    }

    const hook = plugin.lifecycle?.[phase]
    if (hook) {
      await hook(ctx)
    }
  }

  function getOrderedPlugins(): GorseePlugin[] {
    return sortPlugins(plugins)
  }

  return {
    register(plugin: GorseePlugin) {
      if (plugins.some((entry) => entry.name === plugin.name)) {
        throw new Error(`Plugin "${plugin.name}" is already registered.`)
      }
      validatePluginConfig(plugin, config)
      plugins.push(plugin)
      if (plugin.middleware) {
        middlewares.push(plugin.middleware)
      }
    },

    async setupAll() {
      for (const plugin of getOrderedPlugins()) {
        await runPluginPhase(plugin, "runtime")
      }
    },

    async runPhase(phase: PluginPhase) {
      for (const plugin of getOrderedPlugins()) {
        await runPluginPhase(plugin, phase)
      }
    },

    async teardownAll() {
      for (const plugin of [...getOrderedPlugins()].reverse()) {
        if (plugin.teardown) await plugin.teardown()
      }
    },

    getMiddlewares: () => [...middlewares],

    getBuildPlugins(_target?: BuildRuntimeTarget) {
      const result: FrameworkBuildPlugin[] = []
      for (const plugin of getOrderedPlugins()) {
        if (plugin.buildPlugins) result.push(...plugin.buildPlugins())
      }
      return result
    },

    getRoutes: () => new Map(routes),

    getPluginDescriptors() {
      return getOrderedPlugins().map((plugin) => describePlugin(plugin))
    },

    getCapabilities() {
      return [...new Set(getOrderedPlugins().flatMap((plugin) => describePlugin(plugin).capabilities))].sort()
    },
  }
}
