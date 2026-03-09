// Out-of-order streaming SSR
// Sends HTML shell with Suspense fallbacks immediately,
// then streams resolved chunks as data becomes available

import type { Component } from "./jsx-runtime.ts"
import { escapeHTML, escapeAttr, VOID_ELEMENTS, resolveValue } from "./html-escape.ts"

interface SuspenseSlot {
  id: string
  fallback: unknown
  children: unknown
  resolve: () => Promise<unknown>
}

interface StreamContext {
  suspenseSlots: SuspenseSlot[]
  nextId: number
}

interface VNode {
  type: string | Component | symbol
  props: Record<string, unknown>
  __gorsee_suspense?: boolean
}

export function streamJsx(
  type: string | Component | symbol,
  props: Record<string, unknown> | null
): VNode {
  return { type, props: props ?? {} }
}

export const streamJsxs = streamJsx

// Marker for Suspense components in streaming mode
export function StreamSuspense(props: {
  fallback: unknown
  children: unknown
  __streamCtx?: StreamContext
}): VNode {
  const node = streamJsx("gorsee-suspense", {
    fallback: props.fallback,
    children: props.children,
  })
  node.__gorsee_suspense = true
  return node
}

function renderAttrs(props: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [key, rawValue] of Object.entries(props)) {
    if (key === "children" || key === "ref" || key === "fallback" || key.startsWith("on:")) continue
    const value = resolveValue(rawValue)
    if (key === "className" || key === "class") {
      if (value != null) parts.push(` class="${escapeAttr(String(value))}"`)
    } else if (typeof value === "boolean") {
      if (value) parts.push(` ${key}`)
    } else if (value != null) {
      parts.push(` ${key}="${escapeAttr(String(value))}"`)
    }
  }
  return parts.join("")
}

function renderShellNode(node: unknown, ctx: StreamContext): string {
  if (node == null || typeof node === "boolean") return ""

  if (Array.isArray(node)) {
    return node.map((n) => renderShellNode(n, ctx)).join("")
  }

  if (typeof node === "object" && node !== null && "type" in node) {
    const vnode = node as VNode

    // Suspense boundary -- render fallback, register slot for later resolution
    if (vnode.__gorsee_suspense) {
      const id = `s${ctx.nextId++}`
      const fallbackHtml = renderShellNode(vnode.props.fallback, ctx)

      ctx.suspenseSlots.push({
        id,
        fallback: vnode.props.fallback,
        children: vnode.props.children,
        resolve: async () => {
          // Resolve the async children
          const children = vnode.props.children
          if (typeof children === "function") {
            return await (children as () => Promise<unknown>)()
          }
          return children
        },
      })

      return `<div data-g-suspense="${id}">${fallbackHtml}</div>`
    }

    // Fragment
    if (typeof vnode.type === "symbol") {
      return renderShellNode(vnode.props.children, ctx)
    }

    // Component
    if (typeof vnode.type === "function") {
      const result = vnode.type(vnode.props)
      return renderShellNode(result, ctx)
    }

    // HTML element
    const tag = vnode.type as string
    const attrs = renderAttrs(vnode.props)
    if (VOID_ELEMENTS.has(tag)) return `<${tag}${attrs} />`
    const children = renderShellNode(vnode.props.children, ctx)
    return `<${tag}${attrs}>${children}</${tag}>`
  }

  const resolved = resolveValue(node)
  if (resolved == null || typeof resolved === "boolean") return ""
  return escapeHTML(String(resolved))
}

// Generate the inline script that swaps a Suspense fallback with resolved content
export function buildStreamChunkScript(slotId: string, html: string): string {
  return [
    `<template data-g-chunk="${slotId}">${html}</template>`,
    `<script>`,
    `(function(){`,
    `  var t=document.querySelector('[data-g-chunk="${slotId}"]');`,
    `  var s=document.querySelector('[data-g-suspense="${slotId}"]');`,
    `  if(t&&s){var f=t.content.cloneNode(true);s.replaceChildren(...Array.from(f.childNodes));t.remove();s.removeAttribute('data-g-suspense')}`,
    `})();`,
    `</script>`,
  ].join("")
}

export interface StreamOptions {
  shell?: (body: string) => string
}

const defaultShell = (body: string) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Gorsee App</title></head>
<body><div id="app">${body}</div>`

const STREAM_TAIL = `</body></html>`

export function renderToStream(
  root: unknown,
  options?: StreamOptions
): ReadableStream<Uint8Array> {
  const shell = options?.shell ?? defaultShell
  const encoder = new TextEncoder()
  const ctx: StreamContext = { suspenseSlots: [], nextId: 0 }

  return new ReadableStream({
    async start(controller) {
      // 1. Render shell synchronously (with fallbacks for Suspense boundaries)
      const shellHtml = renderShellNode(root, ctx)
      controller.enqueue(encoder.encode(shell(shellHtml)))

      // 2. Resolve each Suspense slot and stream chunks
      const promises = ctx.suspenseSlots.map(async (slot) => {
        try {
          const resolved = await slot.resolve()
          const html = renderShellNode(resolved, ctx)
          const script = buildStreamChunkScript(slot.id, html)
          controller.enqueue(encoder.encode(script))
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          const errorHtml = `<div class="error">Error: ${escapeHTML(message)}</div>`
          const script = buildStreamChunkScript(slot.id, errorHtml)
          controller.enqueue(encoder.encode(script))
        }
      })

      await Promise.all(promises)

      // 3. Close the stream
      controller.enqueue(encoder.encode(STREAM_TAIL))
      controller.close()
    },
  })
}
