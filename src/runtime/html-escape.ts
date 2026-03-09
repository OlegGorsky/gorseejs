// Shared HTML/attribute escape utilities for SSR

const HTML_ESCAPE_RE = /[&<>"']/g
const ATTR_ESCAPE_RE = /["&]/g

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;",
  '"': "&quot;", "'": "&#x27;",
}

export const GORSEE_SIGNAL_MARKER = "__gorseeSignal"

export function escapeHTML(value: string): string {
  return value.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPES[ch] ?? ch)
}

export function escapeAttr(value: string): string {
  return value.replace(ATTR_ESCAPE_RE, (ch) => HTML_ESCAPES[ch] ?? ch)
}

export const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
])

export function isSignal(value: unknown): value is () => unknown {
  return typeof value === "function" && ((value as unknown) as Record<string, unknown>)[GORSEE_SIGNAL_MARKER] === true
}

export function isRenderableThunk(value: unknown): value is () => unknown {
  return typeof value === "function" && value.length === 0 && !isSignal(value)
}

export function resolveValue(value: unknown): unknown {
  return isSignal(value) ? value() : value
}
