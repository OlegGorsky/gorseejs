// Bun plugin that resolves "gorsee/*" imports to framework source
// and transforms JSX in route files to use our runtime

import { plugin } from "bun"
import { resolveFrameworkImport as resolveFrameworkImportImpl } from "../build/framework-imports.ts"

export const resolveFrameworkImport = resolveFrameworkImportImpl

plugin({
  name: "gorsee-resolve",
  setup(build) {
    // Resolve gorsee/* imports
    build.onResolve({ filter: /^gorsee(\/.*)?$/ }, (args) => {
      const mapped = resolveFrameworkImport(args.path)
      if (mapped) {
        return { path: mapped }
      }
      return undefined
    })
  },
})
