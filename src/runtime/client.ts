// Client-side rendering and hydration

import type { GorseeNode } from "./jsx-runtime.ts"
import { jsx } from "./jsx-runtime.ts"
import { enterHydration, exitHydration, isHydrating } from "./hydration.ts"
import { replayEvents } from "./event-replay.ts"
import { isRenderableThunk } from "./html-escape.ts"
import type { GorseeVNodeLike } from "./renderable.ts"

function isVNodeLike(value: unknown): value is GorseeVNodeLike {
  return typeof value === "object" && value !== null && "type" in value && "props" in value
}

function renderVNodeLike(vnode: GorseeVNodeLike): Node | DocumentFragment {
  return jsx(vnode.type, vnode.props)
}

function insertResult(container: Element, result: GorseeNode): void {
  if (result instanceof Node) {
    container.appendChild(result)
  } else if (typeof result === "object" && result !== null && isVNodeLike(result)) {
    container.appendChild(renderVNodeLike(result))
  } else if (Array.isArray(result)) {
    for (const child of result) insertResult(container, child)
  } else if (isRenderableThunk(result)) {
    insertResult(container, result() as GorseeNode)
  } else if (result != null && typeof result !== "boolean") {
    container.appendChild(document.createTextNode(String(result)))
  }
}

export function render(component: () => GorseeNode, container: Element): void {
  container.replaceChildren()
  insertResult(container, component())
}

export function hydrate(component: () => GorseeNode, container: Element): void {
  // Cursor-based hydration: walks server-rendered DOM, attaches bindings
  enterHydration(container)
  let diagnostics
  try {
    component()
    diagnostics = exitHydration()
  } catch (error) {
    if (isHydrating()) exitHydration()
    throw error
  }

  // Fail closed on mismatched ownership: recover through a full client render.
  if (diagnostics.recoverableMismatch) {
    render(component, container)
  }

  // Replay events captured before hydration
  replayEvents(container)
}
