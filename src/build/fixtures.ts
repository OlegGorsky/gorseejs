import type { ClientBuildBackendOptions } from "./client-backend.ts"

export interface ClientBuildParityFixture {
  name: string
  options: ClientBuildBackendOptions
}

export function createClientBuildFixtures(rootDir = ".tmp-build-backend-parity"): ClientBuildParityFixture[] {
  return [
    {
      name: "plain-entry",
      options: {
        entrypoints: [`${rootDir}/plain-entry.ts`],
        outdir: `${rootDir}/dist-plain`,
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
        entrypoints: [`${rootDir}/minified-entry.ts`],
        outdir: `${rootDir}/dist-minified`,
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
          `${rootDir}/multi-a.ts`,
          `${rootDir}/multi-b.ts`,
        ],
        outdir: `${rootDir}/dist-multi`,
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
        entrypoints: [`${rootDir}/sourcemap-entry.ts`],
        outdir: `${rootDir}/dist-sourcemap`,
        minify: false,
        sourcemap: true,
        frameworkResolve() {
          return undefined
        },
        plugins: [],
      },
    },
  ]
}

export const CLIENT_BUILD_FIXTURES: ClientBuildParityFixture[] = createClientBuildFixtures()
