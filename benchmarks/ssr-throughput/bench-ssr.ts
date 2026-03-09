// SSR performance benchmark -- measures renderToString throughput
// Run: bun run bench-ssr.ts [--json]

import { renderToString, ssrJsx } from "../../src/runtime/server.ts"
import { createSignal } from "../../src/reactive/signal.ts"
import { Fragment } from "../../src/runtime/jsx-runtime.ts"

const jsonOutput = process.argv.includes("--json")

// --- Helper: format number with comma separators ---
function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

// --- Test components ---

function SimpleComponent() {
  return ssrJsx("div", {
    children: [
      ssrJsx("h1", { children: "Welcome to Gorsee" }),
      ssrJsx("p", { children: "A full-stack TypeScript framework." }),
      ssrJsx("p", { children: "Safe by default, predictable by design." }),
      ssrJsx("a", { href: "/about", children: "Learn more" }),
      ssrJsx("nav", {
        children: [
          ssrJsx("a", { href: "/", children: "Home" }),
          ssrJsx("a", { href: "/docs", children: "Docs" }),
          ssrJsx("a", { href: "/blog", children: "Blog" }),
        ],
      }),
    ],
  })
}

function MediumComponent() {
  const items = Array.from({ length: 100 }, (_, i) =>
    ssrJsx("li", {
      key: String(i),
      children: ssrJsx("span", { class: "item", children: `Item #${i + 1}` }),
    }),
  )
  return ssrJsx("div", {
    children: [
      ssrJsx("h1", { children: "Item List" }),
      ssrJsx("ul", { children: items }),
    ],
  })
}

function ComplexComponent() {
  const rows = Array.from({ length: 1000 }, (_, r) =>
    ssrJsx("tr", {
      key: String(r),
      children: Array.from({ length: 5 }, (_, c) =>
        ssrJsx("td", { children: `Row ${r + 1}, Col ${c + 1}` }),
      ),
    }),
  )
  return ssrJsx("table", {
    children: [
      ssrJsx("thead", {
        children: ssrJsx("tr", {
          children: Array.from({ length: 5 }, (_, c) =>
            ssrJsx("th", { children: `Column ${c + 1}` }),
          ),
        }),
      }),
      ssrJsx("tbody", { children: rows }),
    ],
  })
}

function DeepNestComponent() {
  let node: unknown = ssrJsx("span", { children: "leaf" })
  for (let i = 0; i < 50; i++) {
    node = ssrJsx("div", { class: `level-${i}`, children: node })
  }
  return node
}

function SignalsComponent() {
  const [count] = createSignal(42)
  const [name] = createSignal("Gorsee")
  return ssrJsx("div", {
    children: [
      ssrJsx("h1", { children: ["Hello, ", name(), "!"] }),
      ssrJsx("p", { children: ["Count: ", String(count())] }),
      ssrJsx("ul", {
        children: Array.from({ length: 10 }, (_, i) =>
          ssrJsx("li", { children: `Signal item ${i + 1}: ${count()}` }),
        ),
      }),
    ],
  })
}

// --- Benchmark runner ---

interface BenchResult {
  name: string
  iterations: number
  totalMs: number
  avgMs: number
  rendersPerSec: number
  htmlSize: number
}

function runBench(name: string, factory: () => unknown, iterations: number): BenchResult {
  // Warm up
  for (let i = 0; i < 100; i++) renderToString(factory())

  const html = renderToString(factory())
  const htmlSize = new TextEncoder().encode(html).byteLength

  const start = performance.now()
  for (let i = 0; i < iterations; i++) renderToString(factory())
  const totalMs = performance.now() - start

  const avgMs = totalMs / iterations
  const rendersPerSec = Math.round((iterations / totalMs) * 1000)

  return { name, iterations, totalMs, avgMs, rendersPerSec, htmlSize }
}

// --- Main ---

const benchmarks: [string, () => unknown, number][] = [
  ["simple", SimpleComponent, 10_000],
  ["medium", MediumComponent, 5_000],
  ["complex", ComplexComponent, 1_000],
  ["deep-nest", DeepNestComponent, 5_000],
  ["signals", SignalsComponent, 5_000],
]

const results = benchmarks.map(([name, factory, n]) => runBench(name, factory, n))

if (jsonOutput) {
  console.log(JSON.stringify(results, null, 2))
} else {
  console.log()
  console.log("  Gorsee.js SSR Benchmark")
  console.log("  " + "\u2500".repeat(60))
  console.log(
    "  " +
      "Component".padEnd(16) +
      "Renders/sec".padStart(14) +
      "Avg(ms)".padStart(12) +
      "HTML size".padStart(14),
  )
  console.log("  " + "\u2500".repeat(60))

  for (const r of results) {
    console.log(
      "  " +
        r.name.padEnd(16) +
        fmt(r.rendersPerSec).padStart(14) +
        r.avgMs.toFixed(3).padStart(10) + " ms" +
        fmtSize(r.htmlSize).padStart(12),
    )
  }

  console.log("  " + "\u2500".repeat(60))
  console.log()
}
