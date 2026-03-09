import { existsSync } from "node:fs"
import { resolve } from "node:path"

const FRAMEWORK_ROOT = resolve(import.meta.dir, "..")

function resolveFrameworkModule(stem: string): string {
  const tsPath = resolve(FRAMEWORK_ROOT, `${stem}.ts`)
  if (existsSync(tsPath)) return tsPath

  const jsPath = resolve(FRAMEWORK_ROOT, `${stem}.js`)
  if (existsSync(jsPath)) return jsPath

  return tsPath
}

const CLIENT_JSX_RUNTIME = resolveFrameworkModule("jsx-runtime-client")
const SERVER_JSX_RUNTIME = resolveFrameworkModule("jsx-runtime")

export const FRAMEWORK_IMPORT_MAP: Record<string, string> = {
  "gorsee": resolveFrameworkModule("index"),
  "gorsee/compat": resolveFrameworkModule("compat"),
  "gorsee/client": resolveFrameworkModule("client"),
  "gorsee/reactive": resolveFrameworkModule("reactive/index"),
  "gorsee/server": resolveFrameworkModule("server-entry"),
  "gorsee/types": resolveFrameworkModule("types/index"),
  "gorsee/db": resolveFrameworkModule("db/index"),
  "gorsee/router": resolveFrameworkModule("router/index"),
  "gorsee/log": resolveFrameworkModule("log/index"),
  "gorsee/unsafe": resolveFrameworkModule("unsafe/index"),
  "gorsee/runtime": resolveFrameworkModule("runtime/index"),
  "gorsee/security": resolveFrameworkModule("security/index"),
  "gorsee/ai": resolveFrameworkModule("ai/index"),
  "gorsee/jsx-runtime": SERVER_JSX_RUNTIME,
  "gorsee/jsx-dev-runtime": SERVER_JSX_RUNTIME,
  "gorsee/testing": resolveFrameworkModule("testing/index"),
  "gorsee/i18n": resolveFrameworkModule("i18n/index"),
  "gorsee/content": resolveFrameworkModule("content/index"),
  "gorsee/env": resolveFrameworkModule("env/index"),
  "gorsee/auth": resolveFrameworkModule("auth/index"),
  "gorsee/forms": resolveFrameworkModule("forms/index"),
  "gorsee/routes": resolveFrameworkModule("routes/index"),
  "gorsee/cli/cmd-create": resolveFrameworkModule("cli/cmd-create"),
  "gorsee/plugins": resolveFrameworkModule("plugins/index"),
  "gorsee/plugins/drizzle": resolveFrameworkModule("plugins/drizzle"),
  "gorsee/plugins/prisma": resolveFrameworkModule("plugins/prisma"),
  "gorsee/plugins/tailwind": resolveFrameworkModule("plugins/tailwind"),
  "gorsee/plugins/lucia": resolveFrameworkModule("plugins/lucia"),
  "gorsee/plugins/s3": resolveFrameworkModule("plugins/s3"),
  "gorsee/plugins/resend": resolveFrameworkModule("plugins/resend"),
  "gorsee/plugins/stripe": resolveFrameworkModule("plugins/stripe"),
  "gorsee/deploy": resolveFrameworkModule("deploy/index"),
}

export const CLIENT_FRAMEWORK_IMPORT_MAP: Record<string, string> = {
  ...FRAMEWORK_IMPORT_MAP,
  "gorsee": resolveFrameworkModule("index-client"),
  "gorsee/jsx-runtime": CLIENT_JSX_RUNTIME,
  "gorsee/jsx-dev-runtime": CLIENT_JSX_RUNTIME,
}

export function resolveFrameworkImport(specifier: string): string | undefined {
  return FRAMEWORK_IMPORT_MAP[specifier]
}

export function resolveClientFrameworkImport(specifier: string): string | undefined {
  return CLIENT_FRAMEWORK_IMPORT_MAP[specifier]
}
