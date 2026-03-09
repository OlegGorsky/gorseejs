// Client-side island hydration
// Scans DOM for data-island elements, hydrates each independently
// Static content around islands stays untouched (zero JS)

import { enterHydration, exitHydration } from "./hydration.ts"
import { replayEvents } from "./event-replay.ts"

type IslandLoader = () => Promise<{ default: (props: Record<string, unknown>) => unknown }>

const islandRegistry = new Map<string, IslandLoader>()

/** Register an island component loader by name. */
export function registerIsland(name: string, loader: IslandLoader): void {
  islandRegistry.set(name, loader)
}

/** Parse the escaped JSON props from a data-props attribute. */
function parseIslandProps(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    console.warn(`[gorsee] Failed to parse island props: ${raw}`)
    return {}
  }
}

/** Hydrate a single island element. */
async function hydrateOne(el: Element): Promise<void> {
  const name = el.getAttribute("data-island")
  if (!name) return

  const loader = islandRegistry.get(name)
  if (!loader) {
    console.warn(`[gorsee] Island "${name}" not found in registry`)
    return
  }

  const mod = await loader()
  const component = mod.default
  const rawProps = el.getAttribute("data-props") ?? "{}"
  const props = parseIslandProps(rawProps)

  enterHydration(el as HTMLElement)
  component(props)
  exitHydration()

  replayEvents(el as HTMLElement)
}

/**
 * Hydrate all island components on the page.
 * Finds all elements with data-island attribute and hydrates each independently.
 * Lazy islands use IntersectionObserver to defer until visible.
 */
export function hydrateIslands(): void {
  const islands = document.querySelectorAll("[data-island]")

  for (let i = 0; i < islands.length; i++) {
    const el = islands[i]!
    const isLazy = el.hasAttribute("data-island-lazy")

    if (isLazy && typeof IntersectionObserver !== "undefined") {
      observeLazy(el)
    } else {
      void hydrateOne(el)
    }
  }
}

/** Observe a lazy island and hydrate when it enters the viewport. */
function observeLazy(el: Element): void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer.unobserve(el)
          void hydrateOne(el)
        }
      }
    },
    { rootMargin: "200px" },
  )
  observer.observe(el)
}
