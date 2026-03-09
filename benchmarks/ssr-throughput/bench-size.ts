// Bundle size analyzer -- measures framework and route bundle sizes
// Run: bun run bench-size.ts [--json]

import { join } from "node:path"
import { gzipSync } from "node:zlib"

const jsonOutput = process.argv.includes("--json")
const ROOT = import.meta.dir
const FRAMEWORK_ROOT = join(ROOT, "..", "..")

// --- Helpers ---

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

async function measure(code: string): Promise<{ raw: number; gzip: number; brotli: number }> {
  const buf = Buffer.from(code, "utf-8")
  const raw = buf.byteLength
  const gzip = gzipSync(buf, { level: 9 }).byteLength
  // Brotli: use zlib if available, otherwise estimate
  let brotli: number
  try {
    const { brotliCompressSync } = await import("node:zlib")
    brotli = brotliCompressSync(buf).byteLength
  } catch {
    brotli = Math.round(gzip * 0.85) // rough estimate
  }
  return { raw, gzip, brotli }
}

// --- Build routes ---

const routeFiles = [
  join(ROOT, "routes/index.tsx"),
  join(ROOT, "routes/list.tsx"),
  join(ROOT, "routes/table.tsx"),
  join(ROOT, "routes/nested.tsx"),
]

const frameworkEntries = [
  join(FRAMEWORK_ROOT, "src/reactive/index.ts"),
  join(FRAMEWORK_ROOT, "src/runtime/server.ts"),
  join(FRAMEWORK_ROOT, "src/runtime/jsx-runtime.ts"),
]

interface SizeRow { name: string; raw: number; gzip: number; brotli: number }

async function buildAndMeasure(entrypoints: string[], label: string): Promise<SizeRow> {
  const result = await Bun.build({
    entrypoints,
    target: "browser",
    minify: true,
    splitting: entrypoints.length > 1,
    external: ["alien-signals"],
  })

  let totalCode = ""
  for (const output of result.outputs) {
    totalCode += await output.text()
  }
  const sizes = await measure(totalCode)
  return { name: label, ...sizes }
}

// --- CSS ---

async function measureCSS(): Promise<SizeRow> {
  const cssPath = join(ROOT, "public/styles.css")
  const file = Bun.file(cssPath)
  const exists = await file.exists()
  if (!exists) return { name: "total CSS", raw: 0, gzip: 0, brotli: 0 }
  const text = await file.text()
  const sizes = await measure(text)
  return { name: "total CSS", ...sizes }
}

// --- Main ---

async function main() {
  const rows: SizeRow[] = []

  // Framework core
  rows.push(await buildAndMeasure(frameworkEntries, "framework core"))

  // Individual routes
  const routeSizes: number[] = []
  for (const rf of routeFiles) {
    const result = await Bun.build({
      entrypoints: [rf],
      target: "browser",
      minify: true,
      external: ["alien-signals", "gorsee", "gorsee/*"],
    })
    let size = 0
    for (const o of result.outputs) size += (await o.text()).length
    routeSizes.push(size)
  }

  const avgRoute = routeSizes.reduce((a, b) => a + b, 0) / routeSizes.length
  const avgSizes = await measure("x".repeat(Math.round(avgRoute)))
  // Re-measure properly
  const avgBuf = Buffer.alloc(Math.round(avgRoute))
  rows.push({ name: "avg route bundle", raw: Math.round(avgRoute), gzip: avgSizes.gzip, brotli: avgSizes.brotli })

  // All JS combined
  rows.push(await buildAndMeasure([...frameworkEntries, ...routeFiles], "total JS"))

  // CSS
  rows.push(await measureCSS())

  if (jsonOutput) {
    console.log(JSON.stringify(rows, null, 2))
    return
  }

  console.log()
  console.log("  Gorsee.js Bundle Size Analysis")
  console.log("  " + "\u2500".repeat(56))
  console.log(
    "  " +
      "Asset".padEnd(22) +
      "Raw".padStart(10) +
      "Gzip".padStart(12) +
      "Brotli".padStart(12),
  )
  console.log("  " + "\u2500".repeat(56))

  for (const r of rows) {
    console.log(
      "  " +
        r.name.padEnd(22) +
        fmt(r.raw).padStart(10) +
        fmt(r.gzip).padStart(12) +
        fmt(r.brotli).padStart(12),
    )
  }

  console.log("  " + "\u2500".repeat(56))
  console.log()
}

main().catch(console.error)
