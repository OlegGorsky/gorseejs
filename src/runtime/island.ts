// Island component wrapper -- marks components for client-side hydration
// Usage: export default island(MyComponent) in route files
// Server: renders component with data-island attribute + serialized props
// Client: returns wrapped element for hydration

import type { VNode } from "./server.ts"
import type { GorseeRenderable } from "./renderable.ts"

export interface IslandOptions {
  lazy?: boolean // load island JS lazily (IntersectionObserver)
}

// Symbol to mark island wrappers for identification
export const ISLAND_MARKER = Symbol("gorsee-island")

interface IslandWrapper<P extends Record<string, unknown>> {
  (props: P): GorseeRenderable
  [ISLAND_MARKER]: true
  componentName: string
  originalComponent: (props: P) => GorseeRenderable
  options: IslandOptions
}

/**
 * Escape a JSON string for safe embedding in HTML data attributes.
 * Prevents breaking out of attribute values or injecting HTML.
 */
function escapePropsForAttr(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/**
 * Wrap a component as an island -- only this component gets hydrated on the client.
 * Static surrounding content stays as server-rendered HTML with zero JS.
 */
export function island<P extends Record<string, unknown>>(
  component: (props: P) => GorseeRenderable,
  options: IslandOptions = {},
): IslandWrapper<P> {
  const name = component.name || "Anonymous"

  const wrapper = function islandWrapper(props: P): GorseeRenderable {
    const propsWithoutChildren = extractSerializableProps(props)
    const serialized = escapePropsForAttr(JSON.stringify(propsWithoutChildren))

    const attrs: Record<string, unknown> = {
      "data-island": name,
      "data-props": serialized,
      children: component(props),
    }

    if (options.lazy) {
      attrs["data-island-lazy"] = "true"
    }

    // On server: ssrJsx produces VNode; on client: jsx produces DOM node
    // We return a plain object that both renderers understand
    return { type: "div", props: attrs } as VNode
  }

  wrapper[ISLAND_MARKER] = true as const
  wrapper.componentName = name
  wrapper.originalComponent = component
  wrapper.options = options

  return wrapper
}

/** Extract only serializable props (skip children, functions, symbols). */
function extractSerializableProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key in props) {
    if (key === "children") continue
    const val = props[key]
    if (typeof val === "function" || typeof val === "symbol") continue
    result[key] = val
  }
  return result
}

export function isIsland(fn: unknown): fn is IslandWrapper<Record<string, unknown>> {
  return typeof fn === "function" && ISLAND_MARKER in fn
}
