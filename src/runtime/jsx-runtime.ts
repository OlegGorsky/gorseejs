// Gorsee.js JSX Runtime
// Compiles JSX to direct DOM operations with reactive bindings
// No Virtual DOM -- signals update DOM nodes directly
// Supports hydration mode: reuses server-rendered DOM nodes

import { createEffect } from "../reactive/effect.ts"
import { isHydrating, claimElement, claimText, pushCursor, popCursor } from "./hydration.ts"
import { isRenderableThunk, isSignal } from "./html-escape.ts"
import type { GorseeRenderable, GorseeVNodeLike } from "./renderable.ts"

export type GorseeNode = Node | string | number | boolean | null | undefined | GorseeNode[]
export type Component = (props: Record<string, unknown>) => GorseeRenderable

export const Fragment = Symbol("Fragment")

export interface JSXElement {
  type: string | Component | symbol
  props: Record<string, unknown>
  children: unknown[]
}

function isVNodeLike(value: unknown): value is GorseeVNodeLike {
  return typeof value === "object" && value !== null && "type" in value && "props" in value
}

function renderVNodeLike(vnode: GorseeVNodeLike): Node | DocumentFragment {
  return jsx(vnode.type, vnode.props)
}

function createTextNode(value: unknown): Text {
  return document.createTextNode(String(value ?? ""))
}

function bindProperty(el: HTMLElement, key: string, value: unknown): void {
  if (key === "children" || key === "ref") return

  if (key.startsWith("on:")) {
    el.addEventListener(key.slice(3), value as EventListener)
    return
  }

  if (key === "className" || key === "class") {
    if (isSignal(value)) {
      createEffect(() => { el.className = String(value()) })
    } else if (!isHydrating()) {
      el.className = String(value ?? "")
    }
    return
  }

  if (key === "style" && typeof value === "object" && value !== null) {
    const styles = value as Record<string, unknown>
    for (const [prop, val] of Object.entries(styles)) {
      if (isSignal(val)) {
        const p = prop
        createEffect(() => { el.style.setProperty(p, String(val())) })
      } else if (!isHydrating()) {
        el.style.setProperty(prop, String(val))
      }
    }
    return
  }

  if (isSignal(value)) {
    createEffect(() => { el.setAttribute(key, String(value())) })
  } else if (!isHydrating()) {
    if (typeof value === "boolean") {
      if (value) el.setAttribute(key, "")
      else el.removeAttribute(key)
    } else if (value != null) {
      el.setAttribute(key, String(value))
    }
  }
}

function hydrateChild(parent: Node, child: unknown): void {
  if (child == null || typeof child === "boolean") return

  if (Array.isArray(child)) {
    for (const c of child) hydrateChild(parent, c)
    return
  }

  if (isVNodeLike(child)) {
    renderVNodeLike(child)
    return
  }

  if (typeof child === "function" && isSignal(child)) {
    const textNode = claimText(String(child() ?? "")) ?? createTextNode(child())
    if (!textNode.parentNode) parent.appendChild(textNode)
    createEffect(() => { textNode.textContent = String(child() ?? "") })
    return
  }

  if (isRenderableThunk(child)) {
    hydrateChild(parent, child())
    return
  }

  if (typeof child === "object" && child instanceof Node) return

  // Static text may share a single SSR text node with adjacent reactive text.
  const textNode = claimText(String(child ?? "")) ?? createTextNode(child)
  if (!textNode.parentNode) parent.appendChild(textNode)
}

function insertChild(parent: Node, child: unknown): void {
  if (child == null || typeof child === "boolean") return

  if (Array.isArray(child)) {
    for (const c of child) insertChild(parent, c)
    return
  }

  if (isVNodeLike(child)) {
    parent.appendChild(renderVNodeLike(child))
    return
  }

  if (child instanceof Node) {
    parent.appendChild(child)
    return
  }

  if (isSignal(child)) {
    const textNode = createTextNode(child())
    parent.appendChild(textNode)
    createEffect(() => { textNode.textContent = String(child() ?? "") })
    return
  }

  if (isRenderableThunk(child)) {
    insertChild(parent, child())
    return
  }

  parent.appendChild(createTextNode(child))
}

export function jsx(
  type: string | Component | symbol,
  props: Record<string, unknown> | null
): Node | DocumentFragment {
  const allProps = props ?? {}
  const children = allProps.children
  const hydrating = isHydrating()

  // Fragment
  if (typeof type === "symbol") {
    if (hydrating) {
      if (children != null) hydrateChild(document.createDocumentFragment(), children)
      return document.createDocumentFragment()
    }
    const frag = document.createDocumentFragment()
    if (children != null) insertChild(frag, children)
    return frag
  }

  // Component
  if (typeof type === "function") {
    const result = type(allProps)
    if (result instanceof Node) return result
    if (isVNodeLike(result)) return renderVNodeLike(result)
    if (isRenderableThunk(result)) {
      const resolved = result()
      if (hydrating) {
        hydrateChild(document.createDocumentFragment(), resolved)
        return document.createDocumentFragment()
      }
      const wrapper = document.createDocumentFragment()
      insertChild(wrapper, resolved)
      return wrapper
    }
    if (hydrating) {
      hydrateChild(document.createDocumentFragment(), result)
      return document.createDocumentFragment()
    }
    const wrapper = document.createDocumentFragment()
    insertChild(wrapper, result)
    return wrapper
  }

  // HTML element
  if (hydrating) {
    const el = claimElement(type) as HTMLElement
    if (el) {
      // Attach event listeners and reactive bindings to existing element
      for (const [key, value] of Object.entries(allProps)) {
        if (key !== "children") bindProperty(el, key, value)
      }
      // Hydrate children
      if (children != null) {
        pushCursor(el)
        hydrateChild(el, children)
        popCursor()
      }
      return el
    }
    // Fallback: element missing from server HTML, create it
  }

  const el = document.createElement(type)
  for (const [key, value] of Object.entries(allProps)) {
    if (key !== "children") bindProperty(el, key, value)
  }
  if (children != null) insertChild(el, children)
  return el
}

export const jsxs = jsx
export const jsxDEV = jsx
