// Hydration context -- cursor-based DOM reuse
// During hydration, jsx() reuses server-rendered DOM nodes
// instead of creating new ones, then attaches reactive bindings

interface HydrationCursor {
  parent: Node
  index: number
}

const stack: HydrationCursor[] = []
let active = false
let mismatches = 0

export interface HydrationDiagnostics {
  active: boolean
  mismatches: number
  recoverableMismatch: boolean
}

export function isHydrating(): boolean {
  return active
}

export function getHydrationMismatches(): number {
  return mismatches
}

export function getHydrationDiagnostics(): HydrationDiagnostics {
  return { active, mismatches, recoverableMismatch: mismatches > 0 }
}

export function resetHydrationDiagnostics(): void {
  mismatches = 0
}

export function enterHydration(root: Element): void {
  active = true
  mismatches = 0
  stack.length = 0
  stack.push({ parent: root, index: 0 })
}

export function exitHydration(): HydrationDiagnostics {
  for (const cursor of stack) {
    mismatches += countRemainingMeaningfulNodes(cursor)
  }
  active = false
  stack.length = 0
  if (mismatches > 0 && typeof console !== "undefined") {
    console.warn(`[gorsee] Hydration completed with ${mismatches} mismatch(es). Server and client HTML may differ.`)
  }
  return getHydrationDiagnostics()
}

export function claimElement(expectedTag?: string): Element | null {
  const cursor = stack[stack.length - 1]
  if (!cursor) return null

  // Skip whitespace-only text nodes and comments (server may differ from client)
  while (cursor.index < cursor.parent.childNodes.length) {
    const node = cursor.parent.childNodes[cursor.index]!
    if (node.nodeType === 1) {
      // Element node — check tag match if provided
      if (expectedTag && (node as Element).tagName.toLowerCase() !== expectedTag.toLowerCase()) {
        mismatches++
        return null
      }
      cursor.index++
      return node as Element
    }
    if (node.nodeType === 3 && node.textContent?.trim() === "") {
      cursor.index++
      continue
    }
    if (node.nodeType === 8) {
      // Comment node -- skip
      cursor.index++
      continue
    }
    break
  }
  return null
}

export function claimText(expectedText?: string): Text | null {
  const cursor = stack[stack.length - 1]
  if (!cursor) return null

  while (cursor.index < cursor.parent.childNodes.length) {
    const node = cursor.parent.childNodes[cursor.index]!
    if (node.nodeType === 3) {
      cursor.index++
      const textNode = node as Text
      if (expectedText !== undefined) {
        const currentText = textNode.textContent ?? ""
        if (currentText !== expectedText) {
          if (currentText.startsWith(expectedText) && expectedText.length < currentText.length) {
            textNode.splitText(expectedText.length)
            textNode.textContent = expectedText
          } else {
            textNode.textContent = expectedText
            mismatches++
          }
        }
      }
      return textNode
    }
    // Skip comments
    if (node.nodeType === 8) {
      cursor.index++
      continue
    }
    break
  }
  return null
}

export function pushCursor(parent: Node): void {
  stack.push({ parent, index: 0 })
}

export function popCursor(): void {
  stack.pop()
}

function countRemainingMeaningfulNodes(cursor: HydrationCursor): number {
  let count = 0
  for (let i = cursor.index; i < cursor.parent.childNodes.length; i++) {
    const node = cursor.parent.childNodes[i]!
    if (node.nodeType === 8) continue
    if (node.nodeType === 3 && node.textContent?.trim() === "") continue
    count++
  }
  return count
}
