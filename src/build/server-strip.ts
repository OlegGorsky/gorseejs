// Bun.build plugin: strips server-only code from client bundles
// - Removes export function load()/loader() and their bodies
// - Replaces server-only modules (gorsee/db) with empty stubs

import type { BunPlugin } from "bun"
import {
  SERVER_ONLY_MODULES,
  SERVER_STUB_MODULES,
  applyRouteClientTransforms,
} from "./route-client-transform.ts"

export const serverStripPlugin: BunPlugin = {
  name: "gorsee-server-strip",
  setup(build) {
    // Replace server-only modules with empty exports
    for (const mod of SERVER_ONLY_MODULES) {
      build.onResolve({ filter: new RegExp(`^${mod.replace("/", "\\/")}$`) }, () => ({
        path: mod,
        namespace: "gorsee-empty",
      }))
    }

    build.onLoad({ filter: /.*/, namespace: "gorsee-empty" }, () => ({
      contents: "export default {}",
      loader: "js",
    }))

    // Replace server modules with lightweight client stubs
    for (const mod of Object.keys(SERVER_STUB_MODULES)) {
      build.onResolve({ filter: new RegExp(`^${mod.replace("/", "\\/")}$`) }, () => ({
        path: mod,
        namespace: "gorsee-stub",
      }))
    }

    build.onLoad({ filter: /.*/, namespace: "gorsee-stub" }, (args) => ({
      contents: SERVER_STUB_MODULES[args.path] ?? "export default {}",
      loader: "js",
    }))

    // Strip route data hooks + transform RPC calls in route files
    build.onLoad({ filter: /routes\/.*\.tsx?$/ }, async (args) => {
      const source = await Bun.file(args.path).text()
      const transformed = applyRouteClientTransforms(source, args.path)
      return { contents: transformed.source, loader: args.path.endsWith(".tsx") ? "tsx" : "ts" }
    })
  },
}
