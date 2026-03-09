// Server-side rendering -- renders component tree to HTML string
// No DOM API used -- pure string concatenation

import type { Component } from "./jsx-runtime.ts"
import { escapeHTML, escapeAttr, isRenderableThunk, VOID_ELEMENTS, resolveValue } from "./html-escape.ts"

export type VNode = {
  type: string | Component | symbol
  props: Record<string, unknown>
}

function renderChild(child: unknown): string {
  if (child == null || typeof child === "boolean") return ""

  if (Array.isArray(child)) {
    let s = ""
    for (let i = 0; i < child.length; i++) s += renderChild(child[i])
    return s
  }

  if (typeof child === "object" && child !== null && "type" in child) {
    return renderVNode(child as VNode)
  }

  if (isRenderableThunk(child)) {
    return renderChild(child())
  }

  const resolved = resolveValue(child)
  if (resolved == null || typeof resolved === "boolean") return ""
  return escapeHTML(String(resolved))
}

function renderAttrs(props: Record<string, unknown>): string {
  let result = ""

  for (const key in props) {
    if (key === "children" || key === "ref" || key.startsWith("on:")) continue

    const value = resolveValue(props[key])

    if (key === "className" || key === "class") {
      if (value != null) result += ` class="${escapeAttr(String(value))}"`
      continue
    }

    if (key === "style" && typeof value === "object" && value !== null) {
      let styles = ""
      for (const p in value as Record<string, unknown>) {
        if (styles) styles += "; "
        const sv = resolveValue((value as Record<string, unknown>)[p])
        if (sv != null) styles += `${p}: ${sv}`
      }
      result += ` style="${escapeAttr(styles)}"`
      continue
    }

    if (typeof value === "boolean") {
      if (value) result += ` ${key}`
    } else if (value != null) {
      result += ` ${key}="${escapeAttr(String(value))}"`
    }
  }

  return result
}

function renderVNode(vnode: VNode): string {
  const { type, props } = vnode

  // Fragment
  if (typeof type === "symbol") {
    return renderChild(props.children)
  }

  // Component
  if (typeof type === "function") {
    const result = type(props)
    return renderChild(result)
  }

  // HTML element
  const tag = type as string
  const attrs = renderAttrs(props)

  if (VOID_ELEMENTS.has(tag)) {
    return `<${tag}${attrs} />`
  }

  const children = renderChild(props.children)
  return `<${tag}${attrs}>${children}</${tag}>`
}

// Server-side jsx function -- creates VNodes instead of DOM nodes
export function ssrJsx(
  type: string | Component | symbol,
  props: Record<string, unknown> | null
): VNode {
  return { type, props: props ?? {} }
}

export const ssrJsxs = ssrJsx

export function renderToString(root: unknown): string {
  return renderChild(root)
}
