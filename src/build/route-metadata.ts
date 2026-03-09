import type { Route } from "../router/scanner.ts"
import { inspectRouteFacts } from "../compiler/route-facts.ts"

export interface RouteBuildMetadata {
  hasLoader: boolean
  declaresPrerender: boolean
}

export async function inspectRouteBuildMetadata(route: Route): Promise<RouteBuildMetadata> {
  const facts = await inspectRouteFacts(route)
  return {
    hasLoader: facts.hasLoader,
    declaresPrerender: facts.declaresPrerender,
  }
}
