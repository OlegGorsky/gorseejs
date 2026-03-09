export type ProcessDeployRuntime = "bun" | "node"

export function isProcessDeployRuntime(value: string | undefined): value is ProcessDeployRuntime {
  return value === "bun" || value === "node"
}
