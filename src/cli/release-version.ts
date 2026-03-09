export type ReleaseChannel = "stable" | "canary" | "rc"

export function planReleaseVersion(input: string, channel: ReleaseChannel): string {
  const parsed = parseVersion(input)
  switch (channel) {
    case "stable":
      return `${parsed.major}.${parsed.minor}.${parsed.patch}`
    case "canary":
      if (parsed.pre?.tag === "canary") {
        return `${parsed.major}.${parsed.minor}.${parsed.patch}-canary.${parsed.pre.number + 1}`
      }
      if (parsed.pre) {
        return `${parsed.major}.${parsed.minor}.${parsed.patch}-canary.0`
      }
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}-canary.0`
    case "rc":
      if (parsed.pre?.tag === "rc") {
        return `${parsed.major}.${parsed.minor}.${parsed.patch}-rc.${parsed.pre.number + 1}`
      }
      if (parsed.pre) {
        return `${parsed.major}.${parsed.minor}.${parsed.patch}-rc.0`
      }
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}-rc.0`
  }
}

function parseVersion(input: string): {
  major: number
  minor: number
  patch: number
  pre?: { tag: Exclude<ReleaseChannel, "stable">; number: number }
} {
  const match = input.match(/^(\d+)\.(\d+)\.(\d+)(?:-(canary|rc)\.(\d+))?$/)
  if (!match) {
    throw new Error(`unsupported version format: ${input}`)
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4]
      ? {
          tag: match[4] as Exclude<ReleaseChannel, "stable">,
          number: Number(match[5]),
        }
      : undefined,
  }
}
