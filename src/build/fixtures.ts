import type { ClientBuildBackendOptions } from "./client-backend.ts"

export interface ClientBuildParityFixture {
  name: string
  options: ClientBuildBackendOptions
}

export const CLIENT_BUILD_FIXTURES: ClientBuildParityFixture[] = [
  {
    name: "plain-entry",
    options: {
      entrypoints: [".tmp-build-backend-parity/plain-entry.ts"],
      outdir: ".tmp-build-backend-parity/dist-plain",
      minify: false,
      sourcemap: false,
      frameworkResolve() {
        return undefined
      },
      plugins: [],
    },
  },
  {
    name: "minified-entry",
    options: {
      entrypoints: [".tmp-build-backend-parity/minified-entry.ts"],
      outdir: ".tmp-build-backend-parity/dist-minified",
      minify: true,
      sourcemap: false,
      frameworkResolve() {
        return undefined
      },
      plugins: [],
    },
  },
  {
    name: "multi-entry",
    options: {
      entrypoints: [
        ".tmp-build-backend-parity/multi-a.ts",
        ".tmp-build-backend-parity/multi-b.ts",
      ],
      outdir: ".tmp-build-backend-parity/dist-multi",
      minify: false,
      sourcemap: false,
      frameworkResolve() {
        return undefined
      },
      plugins: [],
    },
  },
  {
    name: "sourcemap-entry",
    options: {
      entrypoints: [".tmp-build-backend-parity/sourcemap-entry.ts"],
      outdir: ".tmp-build-backend-parity/dist-sourcemap",
      minify: false,
      sourcemap: true,
      frameworkResolve() {
        return undefined
      },
      plugins: [],
    },
  },
]
