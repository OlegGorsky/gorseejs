import { describe, expect, test } from "bun:test"
import { Link } from "../../src/runtime/link.ts"
import { createTypedRoute } from "../../src/runtime/typed-routes.ts"

describe("Link", () => {
  test("accepts route contracts with params and search", () => {
    const userRoute = createTypedRoute("/users/[id]")
    const node = Link({
      href: userRoute,
      params: { id: "42" },
      search: { tab: "activity" },
      children: "User",
    })

    expect(node).toEqual({
      type: "a",
      props: expect.objectContaining({
        href: "/users/42?tab=activity",
        children: "User",
      }),
    })
  })

  test("hover prefetch mode wires explicit hover and focus handlers", () => {
    const node = Link({
      href: "/docs",
      prefetch: "hover",
      children: "Docs",
    })

    expect(node).toEqual({
      type: "a",
      props: expect.objectContaining({
        href: "/docs",
        "on:mouseover": expect.any(Function),
        "on:focus": expect.any(Function),
        children: "Docs",
      }),
    })
  })

  test("viewport prefetch mode marks the anchor for router-managed observation", () => {
    const node = Link({
      href: "/pricing",
      prefetch: "viewport",
      children: "Pricing",
    })

    expect(node).toEqual({
      type: "a",
      props: expect.objectContaining({
        href: "/pricing",
        "data-g-prefetch": "viewport",
        children: "Pricing",
      }),
    })
  })

  test("eager prefetch mode prefetches immediately on the client", () => {
    const originalWindow = globalThis.window
    const originalDocument = globalThis.document
    const headWrites: Array<{ rel?: string; href?: string }> = []

    ;(globalThis as Record<string, unknown>).window = {}
    ;(globalThis as Record<string, unknown>).document = {
      head: {
        appendChild(node: { rel?: string; href?: string }) {
          headWrites.push(node)
        },
      },
      createElement() {
        return {
          rel: "",
          href: "",
          setAttribute() {},
        }
      },
    }

    try {
      Link({
        href: "/eager",
        prefetch: true,
        children: "Eager",
      })

      expect(headWrites).toHaveLength(1)
      expect(headWrites[0]).toEqual(expect.objectContaining({
        rel: "prefetch",
        href: "/eager",
      }))
    } finally {
      ;(globalThis as Record<string, unknown>).window = originalWindow
      ;(globalThis as Record<string, unknown>).document = originalDocument
    }
  })

  test("eager prefetch deduplicates links that differ only by hash", () => {
    const originalWindow = globalThis.window
    const originalDocument = globalThis.document
    const headWrites: Array<{ rel?: string; href?: string }> = []

    ;(globalThis as Record<string, unknown>).window = {
      location: { origin: "http://localhost" },
    }
    ;(globalThis as Record<string, unknown>).document = {
      head: {
        appendChild(node: { rel?: string; href?: string }) {
          headWrites.push(node)
        },
      },
      createElement() {
        return {
          rel: "",
          href: "",
          setAttribute() {},
        }
      },
    }

    try {
      Link({
        href: "/docs?tab=api#overview",
        prefetch: true,
        children: "Overview",
      })
      Link({
        href: "/docs?tab=api#usage",
        prefetch: true,
        children: "Usage",
      })

      expect(headWrites).toHaveLength(1)
      expect(headWrites[0]).toEqual(expect.objectContaining({
        rel: "prefetch",
        href: "/docs?tab=api",
      }))
    } finally {
      ;(globalThis as Record<string, unknown>).window = originalWindow
      ;(globalThis as Record<string, unknown>).document = originalDocument
    }
  })
})
