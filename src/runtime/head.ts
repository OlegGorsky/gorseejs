// <Head> component -- manages document head (title, meta, links)
// Server: collects head elements, injects into HTML shell
// Client: directly manipulates document.head

interface HeadProps {
  children?: unknown
}

// Server-side head collection
let serverHeadElements: string[] = []

export function resetServerHead(): void {
  serverHeadElements = []
}

export function getServerHead(): string[] {
  return serverHeadElements
}

export function Head(props: HeadProps): null {
  const children = props.children
  if (!children) return null

  if (typeof document !== "undefined") {
    // Client-side: apply to document.head
    applyClientHead(children)
  } else {
    // Server-side: collect for injection
    collectServerHead(children)
  }

  return null
}

interface VNode {
  type: string
  props: Record<string, unknown>
}

function isVNode(v: unknown): v is VNode {
  return typeof v === "object" && v !== null && "type" in v && "props" in v
}

function collectServerHead(children: unknown): void {
  if (Array.isArray(children)) {
    for (const child of children) collectServerHead(child)
    return
  }
  if (!isVNode(children)) return

  const { type, props } = children
  if (type === "title" && props.children) {
    serverHeadElements.push(`<title>${String(props.children)}</title>`)
    return
  }

  // Self-closing tags: meta, link, base
  let tag = `<${type}`
  for (const [key, value] of Object.entries(props)) {
    if (key === "children") continue
    if (value != null) tag += ` ${key}="${String(value)}"`
  }
  if (props.children) {
    tag += `>${String(props.children)}</${type}>`
  } else {
    tag += ` />`
  }
  serverHeadElements.push(tag)
}

function applyClientHead(children: unknown): void {
  if (Array.isArray(children)) {
    for (const child of children) applyClientHead(child)
    return
  }
  if (!isVNode(children)) return

  const { type, props } = children

  if (type === "title") {
    document.title = String(props.children ?? "")
    return
  }

  if (type === "meta") {
    // Find existing meta by name or property
    const name = (props.name ?? props.property) as string | undefined
    if (name) {
      const existing = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)
      if (existing) {
        existing.setAttribute("content", String(props.content ?? ""))
        return
      }
    }
    const meta = document.createElement("meta")
    for (const [key, value] of Object.entries(props)) {
      if (key === "children") continue
      if (value != null) meta.setAttribute(key, String(value))
    }
    document.head.appendChild(meta)
    return
  }

  if (type === "link") {
    const el = document.createElement("link")
    for (const [key, value] of Object.entries(props)) {
      if (key === "children") continue
      if (value != null) el.setAttribute(key, String(value))
    }
    el.dataset.gHead = ""
    document.head.appendChild(el)
  }
}
