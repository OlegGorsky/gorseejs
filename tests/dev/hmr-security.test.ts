import { describe, expect, test } from "bun:test"
import { isAllowedHMROrigin } from "../../src/dev.ts"

describe("dev HMR security boundary", () => {
  test("allows websocket upgrade requests from trusted origin", () => {
    const request = new Request("http://localhost:3000/__gorsee_hmr", {
      headers: {
        Origin: "http://localhost:3000",
        Upgrade: "websocket",
      },
    })

    expect(isAllowedHMROrigin(request, "http://localhost:3000")).toBe(true)
  })

  test("rejects websocket upgrade requests from foreign origin", () => {
    const request = new Request("http://localhost:3000/__gorsee_hmr", {
      headers: {
        Origin: "https://evil.example",
        Upgrade: "websocket",
      },
    })

    expect(isAllowedHMROrigin(request, "http://localhost:3000")).toBe(false)
  })

  test("rejects malformed Origin headers during websocket upgrade", () => {
    const request = new Request("http://localhost:3000/__gorsee_hmr", {
      headers: {
        Origin: "not a url",
        Upgrade: "websocket",
      },
    })

    expect(isAllowedHMROrigin(request, "http://localhost:3000")).toBe(false)
  })
})
