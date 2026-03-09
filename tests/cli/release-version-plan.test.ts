import { describe, expect, test } from "bun:test"
import { planReleaseVersion } from "../../src/cli/release-version.ts"

describe("release version planner", () => {
  test("plans the next canary from a stable version", () => {
    expect(planReleaseVersion("0.2.4", "canary")).toBe("0.2.5-canary.0")
  })

  test("increments existing canary prerelease numbers", () => {
    expect(planReleaseVersion("0.2.5-canary.3", "canary")).toBe("0.2.5-canary.4")
  })

  test("promotes canary bases to rc without changing the base version", () => {
    expect(planReleaseVersion("0.2.5-canary.4", "rc")).toBe("0.2.5-rc.0")
  })

  test("increments existing rc prerelease numbers", () => {
    expect(planReleaseVersion("0.2.5-rc.2", "rc")).toBe("0.2.5-rc.3")
  })

  test("normalizes prereleases back to stable", () => {
    expect(planReleaseVersion("0.2.5-rc.3", "stable")).toBe("0.2.5")
  })
})
