export type RuntimeRequestSurface =
  | "hmr"
  | "rpc"
  | "bundle"
  | "static"
  | "prerendered"
  | "route"
  | "not-found"

export interface RuntimeRequestPlanOptions {
  pathname: string
  hasRouteMatch: boolean
  allowHMR?: boolean
  allowPrerendered?: boolean
}

export function createRuntimeRequestPlan(options: RuntimeRequestPlanOptions): RuntimeRequestSurface[] {
  const { pathname, hasRouteMatch, allowHMR = false, allowPrerendered = false } = options
  if (allowHMR && pathname === "/__gorsee_hmr") return ["hmr"]
  if (/^\/api\/_rpc\/[a-zA-Z0-9]+$/.test(pathname)) return ["rpc"]
  if (pathname.startsWith("/_gorsee/")) return ["bundle", "not-found"]

  const plan: RuntimeRequestSurface[] = []
  if (pathname !== "/") {
    plan.push("static")
    if (allowPrerendered) plan.push("prerendered")
  }
  if (hasRouteMatch) plan.push("route")
  plan.push("not-found")
  return plan
}
