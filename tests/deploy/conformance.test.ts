import { describe, expect, test } from "bun:test"
import { generateVercelServerlessEntry } from "../../src/deploy/vercel.ts"
import { generateNetlifyFunction } from "../../src/deploy/netlify.ts"
import {
  assertDeployArtifactConformance,
  validateDeployArtifactConformance,
} from "../../src/deploy/conformance.ts"
import {
  assertTestDeployArtifactConformance,
  testDeployArtifactConformance,
} from "../../src/testing/index.ts"

describe("deploy conformance helpers", () => {
  test("validates required and forbidden tokens", () => {
    const result = validateDeployArtifactConformance({
      name: "sample",
      content: "APP_ORIGIN immutable middleware",
      requiredTokens: ["APP_ORIGIN", "immutable"],
      forbiddenTokens: ["TODO"],
    })

    expect(result).toEqual({
      ok: true,
      missing: [],
      forbidden: [],
      missingPaths: [],
      mismatchedValues: [],
    })
  })

  test("testing surface mirrors deploy conformance helper", () => {
    const result = testDeployArtifactConformance({
      name: "vercel-entry",
      content: generateVercelServerlessEntry(),
      requiredTokens: ["middlewares: []", "APP_ORIGIN"],
      forbiddenTokens: ["TODO"],
    })

    expect(result.ok).toBe(true)
  })

  test("assert helpers throw on conformance drift", () => {
    expect(() => assertDeployArtifactConformance({
      name: "broken",
      content: "only-one-token",
      requiredTokens: ["APP_ORIGIN"],
    })).toThrow("failed deploy conformance")

    expect(() => assertTestDeployArtifactConformance({
      name: "broken-test-surface",
      content: generateNetlifyFunction(),
      requiredTokens: ["APP_ORIGIN", "context.next()"],
      forbiddenTokens: ["forbidden token present sentinel", "TODO"],
    })).not.toThrow()
  })

  test("validates structured JSON and TOML artifact paths and values", () => {
    const jsonResult = validateDeployArtifactConformance({
      name: "vercel.json",
      format: "json",
      content: JSON.stringify({
        version: 2,
        outputDirectory: ".vercel/output",
        routes: [{ src: "/(.*)", dest: "/api/index" }],
      }),
      requiredTokens: [],
      requiredPaths: ["routes"],
      requiredValues: [
        { path: "version", value: 2 },
        { path: "outputDirectory", value: ".vercel/output" },
      ],
    })

    expect(jsonResult.ok).toBe(true)
    expect(jsonResult.missingPaths).toEqual([])
    expect(jsonResult.mismatchedValues).toEqual([])

    const tomlResult = validateDeployArtifactConformance({
      name: "wrangler.toml",
      format: "toml",
      content: `
        name = "demo"
        main = "dist/worker.js"

        [vars]
        APP_ORIGIN = "REPLACE_WITH_APP_ORIGIN"
      `,
      requiredTokens: [],
      requiredPaths: ["vars"],
      requiredValues: [
        { path: "main", value: "dist/worker.js" },
        { path: "vars.APP_ORIGIN", value: "REPLACE_WITH_APP_ORIGIN" },
      ],
    })

    expect(tomlResult.ok).toBe(true)
    expect(tomlResult.missingPaths).toEqual([])
    expect(tomlResult.mismatchedValues).toEqual([])
  })
})
