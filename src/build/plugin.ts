import type { BunPlugin } from "bun"
import type { Plugin as RolldownPlugin } from "rolldown"

export type BuildRuntimeTarget = "bun" | "rolldown"

export interface FrameworkBuildPlugin {
  name: string
  bun?: BunPlugin
  rolldown?: RolldownPlugin
}

export function defineBuildPlugin(plugin: FrameworkBuildPlugin): FrameworkBuildPlugin {
  return plugin
}

export function resolveBuildPluginsForTarget(
  plugins: FrameworkBuildPlugin[],
  target: "bun",
): BunPlugin[]
export function resolveBuildPluginsForTarget(
  plugins: FrameworkBuildPlugin[],
  target: "rolldown",
): RolldownPlugin[]
export function resolveBuildPluginsForTarget(
  plugins: FrameworkBuildPlugin[],
  target: BuildRuntimeTarget,
): Array<BunPlugin | RolldownPlugin> {
  if (target === "bun") {
    return plugins
      .map((plugin) => plugin.bun)
      .filter((plugin): plugin is BunPlugin => Boolean(plugin))
  }

  return plugins
    .map((plugin) => plugin.rolldown)
    .filter((plugin): plugin is RolldownPlugin => Boolean(plugin))
}
