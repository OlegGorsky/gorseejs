export type ReleaseChannel = "stable" | "canary" | "rc"

export function planReleaseVersion(input: string, channel: ReleaseChannel): string
