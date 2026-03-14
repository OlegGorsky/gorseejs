import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import {
  createAIContextPacket,
  createAIDeploySummary,
  createAIIncidentBrief,
  createAIIncidentSnapshot,
  createAIReleaseBrief,
  GORSEE_AI_CONTEXT_SCHEMA_VERSION,
  renderAIDeploySummaryMarkdown,
  renderAIContextMarkdown,
  renderAIIncidentBriefMarkdown,
  renderAIIncidentSnapshotMarkdown,
  renderAIReleaseBriefMarkdown,
} from "../../src/ai/index.ts"

const ROOT_PACKAGE = JSON.parse(await Bun.file(join(process.cwd(), "package.json")).text()) as {
  version: string
}
const RELEASE_TARBALL = `gorsee-${ROOT_PACKAGE.version}.tgz`

describe("ai summary", () => {
  test("creates context packet with hotspots and recommendations", () => {
    const packet = createAIContextPacket({
      app: {
        mode: "server",
        runtimeTopology: "multi-instance",
      },
      release: {
        appMode: "server",
        runtimeKind: "server-runtime",
        processEntrypoints: ["prod.js", "prod-node.js"],
        handlerEntrypoints: ["server-handler.js", "server-handler-node.js"],
        workerEntrypoint: "worker.js",
        summary: {
          routeCount: 1,
          clientAssetCount: 0,
          prerenderedCount: 0,
          serverEntryCount: 5,
        },
        generatedAt: "2026-03-06T00:00:03.000Z",
      },
      readiness: {
        deploy: {
          status: "blocked",
          reasons: ["artifact regressions contain error-level failures."],
        },
        scaling: {
          status: "ready",
          reasons: ["multi-instance topology is declared and no distributed-state blocker signals are present."],
        },
      },
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
          key: `release.check:${RELEASE_TARBALL}`,
          phase: "release.check",
          path: RELEASE_TARBALL,
          version: ROOT_PACKAGE.version,
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
    expect(packet.agent.currentMode).toBe("inspect")
    expect(packet.agent.availableModes).toHaveLength(4)
    expect(packet.agent.transport.modelTraffic).toBe("provider-direct-or-self-hosted")
    expect(packet.app).toEqual({
      mode: "server",
      runtimeTopology: "multi-instance",
    })
    expect(packet.summary.errors).toBe(1)
    expect(packet.release?.runtimeKind).toBe("server-runtime")
    expect(packet.release?.workerEntrypoint).toBe("worker.js")
    expect(packet.readiness.deploy.status).toBe("blocked")
    expect(packet.readiness.scaling.status).toBe("ready")
    expect(packet.hotspots.length).toBeGreaterThan(0)
    expect(packet.recommendations.length).toBeGreaterThan(0)
    expect(packet.incidentClusters[0]?.count).toBe(2)
    expect(packet.artifactRegressions[0]?.path).toBe(RELEASE_TARBALL)
    expect(packet.reactiveTrace?.nodes).toBe(1)
    expect(packet.recommendations.join("\n")).toContain("artifact regressions")
    expect(packet.recommendations.join("\n")).toContain("dist/release.json")
    expect(packet.recommendations.join("\n")).toContain("Reactive trace data is available")
    expect(renderAIContextMarkdown(packet)).toContain("## Incident Clusters")
    expect(renderAIContextMarkdown(packet)).toContain("## App Context")
    expect(renderAIContextMarkdown(packet)).toContain("## AI Agent")
    expect(renderAIContextMarkdown(packet)).toContain("## Release Artifact")
    expect(renderAIContextMarkdown(packet)).toContain("## Readiness")
    expect(renderAIContextMarkdown(packet)).toContain("Deploy: blocked")
    expect(renderAIContextMarkdown(packet)).toContain("Scaling: ready")
    expect(renderAIContextMarkdown(packet)).toContain("Runtime: server-runtime")
    expect(renderAIContextMarkdown(packet)).toContain("Runtime topology: multi-instance")
    expect(renderAIContextMarkdown(packet)).toContain("## Artifact Regressions")
    expect(renderAIContextMarkdown(packet)).toContain("## Reactive Trace")
    expect(renderAIContextMarkdown(packet)).toContain("## Recommendations")
    expect(renderAIContextMarkdown(packet)).toContain(`Schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)

    const releaseBrief = createAIReleaseBrief(packet)
    expect(releaseBrief.verdict).toBe("hold")
    expect(releaseBrief.blockers.length).toBeGreaterThan(0)
    expect(renderAIReleaseBriefMarkdown(releaseBrief)).toContain("# Gorsee AI Release Brief")
    expect(renderAIReleaseBriefMarkdown(releaseBrief)).toContain("Verdict: hold")

    const incidentBrief = createAIIncidentBrief(packet)
    expect(incidentBrief.severity).toBe("critical")
    expect(incidentBrief.incidents.length).toBe(1)
    expect(renderAIIncidentBriefMarkdown(incidentBrief)).toContain("# Gorsee AI Incident Brief")
    expect(renderAIIncidentBriefMarkdown(incidentBrief)).toContain("Severity: critical")

    const deploySummary = createAIDeploySummary(packet)
    expect(deploySummary.status).toBe("blocked")
    expect(deploySummary.workerEntrypoint).toBe("worker.js")
    expect(renderAIDeploySummaryMarkdown(deploySummary)).toContain("# Gorsee AI Deploy Summary")
    expect(renderAIDeploySummaryMarkdown(deploySummary)).toContain("Status: blocked")

    const incidentSnapshot = createAIIncidentSnapshot(packet)
    expect(incidentSnapshot.severity).toBe("critical")
    expect(incidentSnapshot.incidentCount).toBe(1)
    expect(incidentSnapshot.clusterCount).toBe(1)
    expect(renderAIIncidentSnapshotMarkdown(incidentSnapshot)).toContain("# Gorsee AI Incident Snapshot")
    expect(renderAIIncidentSnapshotMarkdown(incidentSnapshot)).toContain("Severity: critical")
  })
})
