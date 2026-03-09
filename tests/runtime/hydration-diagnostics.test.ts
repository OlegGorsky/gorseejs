import { describe, expect, test } from "bun:test"
import {
  claimElement,
  claimText,
  enterHydration,
  exitHydration,
  getHydrationDiagnostics,
  getHydrationMismatches,
  resetHydrationDiagnostics,
} from "../../src/runtime/hydration.ts"

function textNode(textContent: string) {
  return {
    nodeType: 3,
    textContent,
    splitText(offset: number) {
      const remainder = textNode(textContent.slice(offset))
      this.textContent = textContent.slice(0, offset)
      return remainder
    },
  }
}

function commentNode() {
  return { nodeType: 8, textContent: "" }
}

function elementNode(tagName: string) {
  return { nodeType: 1, tagName, childNodes: [] as unknown[] }
}

describe("hydration diagnostics", () => {
  test("counts tag mismatches", () => {
    const root = {
      childNodes: [
        elementNode("span"),
      ],
    }

    resetHydrationDiagnostics()
    enterHydration(root as unknown as Element)
    expect(claimElement("div")).toBeNull()
    exitHydration()

    expect(getHydrationMismatches()).toBe(2)
    expect(getHydrationDiagnostics()).toEqual({ active: false, mismatches: 2, recoverableMismatch: true })
  })

  test("tag mismatch does not consume the next real element", () => {
    const root = {
      childNodes: [
        elementNode("div"),
      ],
    }

    resetHydrationDiagnostics()
    enterHydration(root as unknown as Element)
    expect(claimElement("title")).toBeNull()
    expect(claimElement("div")).toEqual(root.childNodes[0]! as unknown as Element)
    exitHydration()

    expect(getHydrationMismatches()).toBe(1)
    expect(getHydrationDiagnostics()).toEqual({ active: false, mismatches: 1, recoverableMismatch: true })
  })

  test("counts meaningful leftover nodes at hydration exit", () => {
    const root = {
      childNodes: [
        textNode("  "),
        commentNode(),
        elementNode("div"),
        textNode("hello"),
      ],
    }

    resetHydrationDiagnostics()
    enterHydration(root as unknown as Element)
    exitHydration()

    expect(getHydrationMismatches()).toBe(2)
    expect(getHydrationDiagnostics()).toEqual({ active: false, mismatches: 2, recoverableMismatch: true })
  })

  test("claimText splits a shared SSR text node for adjacent static and reactive text children", () => {
    const root = {
      childNodes: [] as Array<ReturnType<typeof textNode>>,
    }
    const sharedText = textNode("Count: 0")
    sharedText.splitText = (offset: number) => {
      const remainder = textNode((sharedText.textContent ?? "").slice(offset))
      sharedText.textContent = (sharedText.textContent ?? "").slice(0, offset)
      root.childNodes.splice(1, 0, remainder)
      return remainder
    }
    root.childNodes.push(sharedText)

    resetHydrationDiagnostics()
    enterHydration(root as unknown as Element)
    const staticText = claimText("Count: ")
    const reactiveText = claimText("0")
    exitHydration()

    expect(staticText?.textContent).toBe("Count: ")
    expect(reactiveText?.textContent).toBe("0")
    expect(getHydrationMismatches()).toBe(0)
    expect(getHydrationDiagnostics()).toEqual({ active: false, mismatches: 0, recoverableMismatch: false })
  })
})
