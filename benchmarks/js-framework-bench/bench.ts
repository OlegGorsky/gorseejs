/**
 * Gorsee.js DOM Benchmark -- signal/data operation runner.
 * Measures pure reactive layer performance (no DOM, runs in Bun).
 */

import { createSignal } from "../../src/reactive/signal.ts"

// --- Data generation (duplicated for isolation) ---

const adjectives = [
  "pretty", "large", "big", "small", "tall", "short", "long", "handsome",
  "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful",
  "mushy", "odd", "unsightly", "adorable",
]
const colours = [
  "red", "yellow", "blue", "green", "pink",
  "brown", "purple", "orange", "white", "black",
]
const nouns = [
  "table", "chair", "house", "bbq", "desk", "car", "pony", "cookie",
  "sandwich", "burger", "pizza", "mouse", "keyboard", "monitor", "speaker",
  "phone", "laptop", "camera", "book", "pencil",
]

let nextId = 1
function random(max: number) { return (Math.random() * max) | 0 }

type Row = { id: number; label: string }

function buildData(count: number): Row[] {
  const data = new Array(count)
  for (let i = 0; i < count; i++) {
    data[i] = {
      id: nextId++,
      label: `${adjectives[random(adjectives.length)]} ${colours[random(colours.length)]} ${nouns[random(nouns.length)]}`,
    }
  }
  return data
}

// --- Benchmark harness ---

interface BenchResult {
  name: string
  avg: number
  min: number
  max: number
  runs: number
}

function bench(name: string, iterations: number, fn: () => void): BenchResult {
  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    fn()
    times.push(performance.now() - start)
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const min = Math.min(...times)
  const max = Math.max(...times)
  return { name, avg, min, max, runs: iterations }
}

// --- Benchmark cases ---

function runBenchmarks(): BenchResult[] {
  const results: BenchResult[] = []

  results.push(bench("create1k", 10, () => {
    const [, setData] = createSignal<Row[]>([])
    setData(buildData(1000))
  }))

  results.push(bench("create10k", 5, () => {
    const [, setData] = createSignal<Row[]>([])
    setData(buildData(10000))
  }))

  results.push(bench("append1k", 10, () => {
    const [, setData] = createSignal<Row[]>(buildData(1000))
    setData((prev) => [...prev, ...buildData(1000)])
  }))

  results.push(bench("update10th", 10, () => {
    const [, setData] = createSignal<Row[]>(buildData(10000))
    setData((prev) =>
      prev.map((row, i) =>
        i % 10 === 0 ? { ...row, label: row.label + " !!!" } : row,
      ),
    )
  }))

  results.push(bench("swap", 50, () => {
    const [, setData] = createSignal<Row[]>(buildData(1000))
    setData((prev) => {
      const next = [...prev]
      const tmp = next[1]
      next[1] = next[998]
      next[998] = tmp
      return next
    })
  }))

  results.push(bench("clear", 10, () => {
    const [, setData] = createSignal<Row[]>(buildData(10000))
    setData([])
  }))

  results.push(bench("selectRow", 50, () => {
    const [, setSelected] = createSignal<number | null>(null)
    setSelected(42)
  }))

  return results
}

// --- Output ---

const jsonFlag = process.argv.includes("--json")
const results = runBenchmarks()

if (jsonFlag) {
  console.log(JSON.stringify(results, null, 2))
} else {
  const fmt = (n: number) => n.toFixed(2).padStart(8) + "ms"
  console.log("\nGorsee.js DOM Benchmark (signal operations)")
  console.log("\u2500".repeat(52))
  console.log(
    "  Name".padEnd(16) +
    "Avg".padStart(10) +
    "Min".padStart(10) +
    "Max".padStart(10) +
    "  Runs",
  )
  console.log("\u2500".repeat(52))
  for (const r of results) {
    console.log(
      `  ${r.name.padEnd(14)}${fmt(r.avg)}${fmt(r.min)}${fmt(r.max)}  ${String(r.runs).padStart(4)}`,
    )
  }
  console.log("\u2500".repeat(52))
}
