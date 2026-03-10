#!/usr/bin/env node

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, relative, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const rootPackage = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const examplesDoc = readFileSync(join(repoRoot, "docs/EXAMPLES_POLICY.md"), "utf-8")
const examplesReadme = readFileSync(join(repoRoot, "examples/README.md"), "utf-8")

const examples = [
  {
    name: "frontend-app",
    dir: join(repoRoot, "examples", "frontend-app"),
    requiredTokens: [
      'from "gorsee/client"',
      'mode: "frontend"',
      "prerender = true",
      "browser-safe",
      "no process runtime",
    ],
  },
  {
    name: "secure-saas",
    dir: join(repoRoot, "examples", "secure-saas"),
    requiredTokens: [
      'from "gorsee/server"',
      'from "gorsee/client"',
      'from "gorsee/auth"',
      "createAuth",
      "routeCache",
      'mode: "private"',
    ],
  },
  {
    name: "content-site",
    dir: join(repoRoot, "examples", "content-site"),
    requiredTokens: [
      'from "gorsee/server"',
      'from "gorsee/client"',
      'mode: "public"',
      "includeAuthHeaders: false",
      "prerender = true",
    ],
  },
  {
    name: "agent-aware-ops",
    dir: join(repoRoot, "examples", "agent-aware-ops"),
    requiredTokens: [
      'from "gorsee/server"',
      'from "gorsee/client"',
      "enabled: true",
      "gorsee ai ide-sync",
      "gorsee ai mcp",
    ],
  },
  {
    name: "workspace-monorepo",
    dir: join(repoRoot, "examples", "workspace-monorepo"),
    requiredTokens: [
      "@example/shared",
      'from "gorsee/auth"',
      'import type { Context } from "gorsee/server"',
      'from "gorsee/client"',
      "workspace-example-ready",
    ],
    workspace: true,
  },
  {
    name: "server-api",
    dir: join(repoRoot, "examples", "server-api"),
    requiredTokens: [
      'from "gorsee/server"',
      'mode: "server"',
      "createMemoryJobQueue",
      "defineJob",
      'service: "gorsee-server-api"',
    ],
  },
]

for (const token of [
  "Examples Policy",
  "mature product surface",
  "examples/secure-saas",
  "examples/content-site",
  "examples/agent-aware-ops",
  "examples/workspace-monorepo",
  "examples/frontend-app",
  "examples/server-api",
  "clean, reproducible proof surfaces",
  "`bun run examples:policy`",
  "`npm run install:matrix`",
  "`npm run release:smoke`",
]) {
  assertIncludes(examplesDoc, token, `examples policy doc missing token: ${token}`)
}

for (const token of [
  "Canonical Examples",
  "examples/secure-saas",
  "examples/content-site",
  "examples/agent-aware-ops",
  "examples/workspace-monorepo",
  "examples/frontend-app",
  "examples/server-api",
  "product-grade reference apps",
]) {
  assertIncludes(examplesReadme, token, `examples README missing token: ${token}`)
}

for (const example of examples) {
  const pkg = JSON.parse(readFileSync(join(example.dir, "package.json"), "utf-8"))
  const readme = readFileSync(join(example.dir, "README.md"), "utf-8")
  const files = readConcatenatedExampleFiles(example.dir)

  if (pkg.packageManager !== "bun@1.3.9") {
    throw new Error(`example ${example.name} must pin packageManager bun@1.3.9`)
  }
  if (example.workspace) {
    const appPkg = JSON.parse(readFileSync(join(example.dir, "apps", "web", "package.json"), "utf-8"))
    if (appPkg.dependencies?.gorsee !== "file:../../../../") {
      throw new Error(`example ${example.name} app must depend on gorsee via file:../../../../`)
    }
  } else if (pkg.dependencies?.gorsee !== "file:../../") {
    throw new Error(`example ${example.name} must depend on gorsee via file:../../`)
  }
  const bunLockPath = join(example.dir, "bun.lock")
  if (existsSync(bunLockPath)) {
    throw new Error(`example ${example.name} must not commit bun.lock while it depends on gorsee via file:../../`)
  }

  const packageLockPath = join(example.dir, "package-lock.json")
  if (existsSync(packageLockPath)) {
    const packageLock = readFileSync(packageLockPath, "utf-8")
    if (packageLock.includes('"@types/bun": "latest"')) {
      throw new Error(`example ${example.name} package-lock must not keep @types/bun as latest`)
    }
    if (!packageLock.includes(`"version": "${rootPackage.version}"`)) {
      throw new Error(`example ${example.name} package-lock must track gorsee version ${rootPackage.version}`)
    }
    if (!packageLock.includes('"bun": "1.3.9"')) {
      throw new Error(`example ${example.name} package-lock must pin bun engine 1.3.9`)
    }
  }
  for (const scriptName of ["dev", "build", "start", "check"]) {
    const sourcePkg = example.workspace
      ? JSON.parse(readFileSync(join(example.dir, "apps", "web", "package.json"), "utf-8"))
      : pkg
    if (!sourcePkg.scripts?.[scriptName]) {
      throw new Error(`example ${example.name} missing script: ${scriptName}`)
    }
    if (sourcePkg.devDependencies?.["@types/bun"] !== "1.3.10") {
      throw new Error(`example ${example.name} must pin @types/bun 1.3.10`)
    }
  }
  assertIncludes(readme, "mature product", `example ${example.name} README must describe mature product context`)
  for (const token of example.requiredTokens) {
    assertIncludes(files, token, `example ${example.name} missing contract token: ${token}`)
  }
  assertNoForbiddenArtifacts(example.dir, `example ${example.name}`)
}

console.log("examples:policy OK")

function readConcatenatedExampleFiles(exampleDir) {
  const files = [join(exampleDir, "README.md")]
  if (!exampleDir.endsWith("workspace-monorepo")) {
    files.push(
      join(exampleDir, "app.config.ts"),
      join(exampleDir, "tsconfig.json"),
    )
  }
  if (exampleDir.endsWith("secure-saas")) {
    files.push(
      join(exampleDir, "auth-shared.ts"),
      join(exampleDir, "routes", "index.tsx"),
      join(exampleDir, "routes", "app", "_middleware.ts"),
      join(exampleDir, "routes", "app", "dashboard.tsx"),
    )
  }
  if (exampleDir.endsWith("frontend-app")) {
    files.push(
      join(exampleDir, "routes", "index.tsx"),
      join(exampleDir, "routes", "about.tsx"),
    )
  }
  if (exampleDir.endsWith("content-site")) {
    files.push(
      join(exampleDir, "routes", "_middleware.ts"),
      join(exampleDir, "routes", "index.tsx"),
      join(exampleDir, "routes", "blog", "[slug].tsx"),
    )
  }
  if (exampleDir.endsWith("server-api")) {
    files.push(
      join(exampleDir, "routes", "api", "index.ts"),
      join(exampleDir, "routes", "api", "health.ts"),
    )
  }
  if (exampleDir.endsWith("agent-aware-ops")) {
    files.push(
      join(exampleDir, "routes", "index.tsx"),
      join(exampleDir, "routes", "ops.tsx"),
    )
  }
  if (exampleDir.endsWith("workspace-monorepo")) {
    files.push(
      join(exampleDir, "README.md"),
      join(exampleDir, "apps", "web", "app.config.ts"),
      join(exampleDir, "apps", "web", "routes", "index.tsx"),
      join(exampleDir, "apps", "web", "routes", "api", "session.ts"),
      join(exampleDir, "packages", "shared", "index.ts"),
    )
  }
  return files.map((file) => readFileSync(file, "utf-8")).join("\n")
}

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message)
  }
}

function assertNoForbiddenArtifacts(rootDir, label) {
  const forbiddenNames = new Set(["node_modules", "dist", ".gorsee"])
  const forbiddenPrefixes = [".gorsee-", ".old-"]
  const forbiddenSuffixes = [".db", ".sqlite"]

  for (const entry of walkEntries(rootDir)) {
    const name = entry.split("/").pop() ?? entry
    if (
      forbiddenNames.has(name) ||
      forbiddenPrefixes.some((prefix) => name.startsWith(prefix)) ||
      forbiddenSuffixes.some((suffix) => name.endsWith(suffix))
    ) {
      throw new Error(`${label} must not ship generated/install artifact: ${relative(repoRoot, entry)}`)
    }
  }
}

function* walkEntries(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    yield fullPath
    if (entry.isDirectory()) {
      yield* walkEntries(fullPath)
    }
  }
}
