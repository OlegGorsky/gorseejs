#!/usr/bin/env bun

import { execFileSync } from "node:child_process"
import { chmod, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, extname, join, relative, resolve } from "node:path"

const repoRoot = resolve(import.meta.dir, "..")
const srcDir = join(repoRoot, "src")
const outDir = join(repoRoot, "dist-pkg")
const tsconfigPath = join(repoRoot, "tsconfig.publish.json")

const transpilers = {
  ts: new Bun.Transpiler({
    loader: "ts",
    target: "bun",
    tsconfig: {
      compilerOptions: {
        jsx: "react-jsx",
        jsxImportSource: "gorsee",
      },
    },
  }),
  tsx: new Bun.Transpiler({
    loader: "tsx",
    target: "bun",
    tsconfig: {
      compilerOptions: {
        jsx: "react-jsx",
        jsxImportSource: "gorsee",
      },
    },
  }),
}

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const sourceFiles = await listSourceFiles(srcDir)
for (const file of sourceFiles) {
  const rel = relative(srcDir, file)
  const outFile = join(outDir, rel).replace(/\.(?:[cm]?ts|tsx)$/, ".js")
  const loader = extname(file) === ".tsx" ? "tsx" : "ts"
  const source = rewriteModuleSpecifiers(await readFile(file, "utf-8"))
  const transpiled = transpilers[loader].transformSync(source)
  await mkdir(dirname(outFile), { recursive: true })
  await writeFile(outFile, transpiled, "utf-8")
}

execFileSync("bunx", ["tsc", "-p", tsconfigPath], {
  cwd: repoRoot,
  stdio: "inherit",
})

const declarationFiles = await listDeclarationFiles(outDir)
for (const file of declarationFiles) {
  const source = await readFile(file, "utf-8")
  await writeFile(file, rewriteModuleSpecifiers(source), "utf-8")
}

const binPath = join(outDir, "bin", "gorsee.js")
await mkdir(dirname(binPath), { recursive: true })
await writeFile(binPath, '#!/usr/bin/env bun\nimport "../cli/index.js"\n', "utf-8")
await chmod(binPath, 0o755)

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listSourceFiles(full))
      continue
    }

    if (!/\.(?:[cm]?ts|tsx)$/.test(entry.name)) continue
    files.push(full)
  }

  return files.sort()
}

async function listDeclarationFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listDeclarationFiles(full))
      continue
    }

    if (entry.name.endsWith(".d.ts")) files.push(full)
  }

  return files.sort()
}

function rewriteModuleSpecifiers(source: string): string {
  return source
    .replace(/(from\s*["'])(\.\.?\/[^"']+?)\.(?:[cm]?ts|tsx)(["'])/g, "$1$2.js$3")
    .replace(/(import\s*\(\s*["'])(\.\.?\/[^"']+?)\.(?:[cm]?ts|tsx)(["']\s*\))/g, "$1$2.js$3")
    .replace(/(new URL\(\s*["'])(\.\.?\/[^"']+?)\.(?:[cm]?ts|tsx)(["'])/g, "$1$2.js$3")
}
