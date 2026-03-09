// gorsee routes -- list all routes

import { createRouter } from "../router/scanner.ts"
import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"

export interface RoutesCommandOptions extends RuntimeOptions {}

export async function listRoutes(options: RoutesCommandOptions = {}) {
  const { cwd, paths } = createProjectContext(options)
  const routes = await createRouter(paths.routesDir)

  if (routes.length === 0) {
    console.log("\n  No routes found in routes/\n")
    return
  }

  console.log("\n  Routes:\n")
  console.log("  " + "Path".padEnd(25) + "File".padEnd(40) + "Params")
  console.log("  " + "-".repeat(70))

  for (const route of routes) {
    const params = route.params.length > 0 ? route.params.join(", ") : "-"
    console.log(
      "  " +
      route.path.padEnd(25) +
      route.filePath.replace(cwd + "/", "").padEnd(40) +
      params
    )
  }
  console.log()
}

/** @deprecated Use listRoutes() for programmatic access. */
export async function runRoutes(_args: string[], options: RoutesCommandOptions = {}) {
  return listRoutes(options)
}
