import { describe, expect, test } from "bun:test"
import { createAIContextPacket, GORSEE_AI_CONTEXT_SCHEMA_VERSION, renderAIContextMarkdown } from "../../src/ai/index.ts"

describe("ai summary", () => {
  test("creates context packet with hotspots and recommendations", () => {
    const packet = createAIContextPacket({
      events: {
        total: 3,
        bySeverity: { error: 1, warn: 1, info: 1 },
        byKind: { "request.error": 1, "route.match": 2 },
      },
      diagnostics: {
        total: 1,
        errors: 1,
        warnings: 1,
        latest: { code: "E905", message: "unsafe redirect", severity: "error" } as any,
      },
      incidents: [
        { kind: "request.error", message: "boom", ts: "2026-03-06T00:00:00.000Z", route: "/login" },
      ],
      incidentClusters: [
        { key: "request:req-1", count: 2, kind: "request.error", latestTs: "2026-03-06T00:00:01.000Z", route: "/login", messages: ["boom"], codes: [] },
      ],
      artifactRegressions: [
        {
          key: "release.check:gorsee-0.2.4.tgz",
          phase: "release.check",
          path: "gorsee-0.2.4.tgz",
          version: "0.2.4",
          errors: 1,
          warnings: 0,
          successes: 0,
          latestTs: "2026-03-06T00:00:02.000Z",
          latestStatus: "error",
          messages: ["tarball validation failed"],
        },
      ],
    }, [
      { id: "1", kind: "request.error", severity: "error", ts: "2026-03-06T00:00:00.000Z", source: "runtime", message: "boom", route: "/login" },
      { id: "2", kind: "route.match", severity: "info", ts: "2026-03-06T00:00:01.000Z", source: "runtime", message: "route matched", route: "/login" },
      { id: "3", kind: "route.match", severity: "warn", ts: "2026-03-06T00:00:02.000Z", source: "runtime", message: "route matched", route: "/login", file: "routes/login.tsx" },
    ], { code: "E905", message: "unsafe redirect" }, {
      schemaVersion: 1,
      snapshot: {
        signalsCreated: 1,
        signalReads: 1,
        signalWrites: 1,
        computedCreated: 0,
        computedReads: 0,
        computedRuns: 0,
        effectCreated: 0,
        effectRuns: 0,
        resourcesCreated: 0,
        resourceLoadsStarted: 0,
        resourceLoadsSucceeded: 0,
        resourceLoadsFailed: 0,
        resourceInvalidations: 0,
        resourceMutations: 0,
        mutationsCreated: 0,
        mutationRuns: 0,
        mutationSuccesses: 0,
        mutationFailures: 0,
        mutationRollbacks: 0,
        mutationResets: 0,
      },
      nodes: [{ id: 1, kind: "signal", reads: 1, writes: 1, runs: 0, invalidations: 0 }],
      edges: [],
      events: [{ seq: 1, kind: "signal:write", nodeId: 1 }],
    })

    expect(packet.schemaVersion).toBe(GORSEE_AI_CONTEXT_SCHEMA_VERSION)
    expect(packet.summary.errors).toBe(1)
    expect(packet.hotspots.length).toBeGreaterThan(0)
    expect(packet.recommendations.length).toBeGreaterThan(0)
    expect(packet.incidentClusters[0]?.count).toBe(2)
    expect(packet.artifactRegressions[0]?.path).toBe("gorsee-0.2.4.tgz")
    expect(packet.reactiveTrace?.nodes).toBe(1)
    expect(packet.recommendations.join("\n")).toContain("artifact regressions")
    expect(packet.recommendations.join("\n")).toContain("Reactive trace data is available")
    expect(renderAIContextMarkdown(packet)).toContain("## Incident Clusters")
    expect(renderAIContextMarkdown(packet)).toContain("## Artifact Regressions")
    expect(renderAIContextMarkdown(packet)).toContain("## Reactive Trace")
    expect(renderAIContextMarkdown(packet)).toContain("## Recommendations")
    expect(renderAIContextMarkdown(packet)).toContain(`Schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)
  })
})
