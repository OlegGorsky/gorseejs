import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { buildClientBundles } from "../../src/build/client.ts"
import {
  formatClientBuildLog,
  normalizeClientBuildLog,
  summarizeClientBuildFailure,
  type ClientBuildLog,
} from "../../src/build/diagnostics.ts"
import type { ClientBuildBackend } from "../../src/build/client-backend.ts"
import type { Route } from "../../src/router/scanner.ts"

const ROUTES: Route[] = [{
  path: "/",
  pattern: /^\/$/,
  filePath: `${process.cwd()}/routes/index.tsx`,
  isDynamic: false,
  params: [],
  layoutPath: null,
  layoutPaths: [],
  middlewarePath: null,
  middlewarePaths: [],
  errorPath: null,
  loadingPath: null,
}]

let consoleErrorSpy: ReturnType<typeof spyOn<typeof console, "error">> | undefined

afterEach(() => {
  consoleErrorSpy?.mockRestore()
  consoleErrorSpy = undefined
})

describe("build diagnostics", () => {
  test("formats structured backend diagnostics with actionable context", () => {
    const line = formatClientBuildLog({
      backend: "rolldown",
      phase: "transform",
      severity: "error",
      code: "ROLLDOWN_PARSE_FAILURE",
      file: "routes/index.tsx",
      plugin: "gorsee-rolldown-resolve",
      message: "Unexpected token",
      detail: "1 | export default <main />",
    })

    expect(line).toContain("backend=rolldown")
    expect(line).toContain("phase=transform")
    expect(line).toContain("code=ROLLDOWN_PARSE_FAILURE")
    expect(line).toContain("file=routes/index.tsx")
    expect(line).toContain("plugin=gorsee-rolldown-resolve")
    expect(line).toContain("Unexpected token")
    expect(line).toContain("export default <main />")
  })

  test("normalizes sparse backend diagnostics into canonical failure shape", () => {
    const normalized = normalizeClientBuildLog({ message: "backend blew up" }, {
      backend: "stub",
      phase: "bundle",
      severity: "error",
      code: "BUILD_BACKEND_FAILURE",
    })

    expect(normalized).toEqual({
      backend: "stub",
      phase: "bundle",
      severity: "error",
      code: "BUILD_BACKEND_FAILURE",
      message: "backend blew up",
    })
  })

  test("summarizes failed client builds with backend and diagnostic count", () => {
    const summary = summarizeClientBuildFailure("rolldown", [{
      backend: "rolldown",
      phase: "bundle",
      severity: "error",
      code: "ROLLDOWN_BUILD_FAILURE",
      message: "Unexpected token",
    }, {
      backend: "rolldown",
      phase: "emit",
      severity: "error",
      code: "ROLLDOWN_EMIT_FAILURE",
      message: "Could not write chunk",
    }])

    expect(summary).toContain("Client build failed:")
    expect(summary).toContain("backend=rolldown")
    expect(summary).toContain("Unexpected token")
    expect(summary).toContain("1 more diagnostic(s)")
  })

  test("client build failure prints structured diagnostics before throwing", async () => {
    const diagnostics: ClientBuildLog[] = [{
      backend: "stub",
      phase: "transform",
      severity: "error",
      code: "STUB_PARSE_FAILURE",
      file: "routes/index.tsx",
      message: "Unexpected token",
    }]
    const backend: ClientBuildBackend = {
      name: "stub",
      async build() {
        return { success: false, logs: diagnostics }
      },
    }
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {})

    await expect(buildClientBundles(ROUTES, process.cwd(), { backend })).rejects.toThrow(/backend=stub/)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[build]",
      expect.stringContaining("code=STUB_PARSE_FAILURE"),
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[build]",
      expect.stringContaining("file=routes/index.tsx"),
    )
  })
})
