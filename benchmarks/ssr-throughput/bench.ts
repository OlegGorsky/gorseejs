// HTTP throughput benchmark -- measures requests/sec, TTFB, latency percentiles
// Run: bun run bench.ts [--concurrency <n>] [--requests <n>]

function parseArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name)
  if (idx !== -1 && process.argv[idx + 1]) return parseInt(process.argv[idx + 1]!, 10)
  return fallback
}

const CONCURRENCY = parseArg("--concurrency", 50)
const TOTAL = parseArg("--requests", 1000)
const PORT = 3199

// --- Start server ---

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      })
    }
    // Inline SSR for benchmark (avoid full dev server overhead)
    const { renderToString, ssrJsx } = await import("../../src/runtime/server.ts")
    const items = Array.from({ length: 100 }, (_, i) =>
      ssrJsx("li", { children: `Item ${i + 1}` }),
    )
    const vnode = ssrJsx("html", {
      children: ssrJsx("body", {
        children: [
          ssrJsx("h1", { children: "Benchmark Page" }),
          ssrJsx("ul", { children: items }),
        ],
      }),
    })
    const html = renderToString(vnode)
    return new Response(html, { headers: { "Content-Type": "text/html" } })
  },
})

console.log(`  Server running on http://localhost:${PORT}`)

// --- Helpers ---

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]!
}

// --- Fire requests ---

async function runBench() {
  const baseUrl = `http://localhost:${PORT}/`
  const latencies: number[] = []

  // Warm up
  for (let i = 0; i < 20; i++) await fetch(baseUrl)

  const memBefore = process.memoryUsage().rss

  const queue: Promise<void>[] = []
  let completed = 0
  const totalStart = performance.now()

  for (let i = 0; i < TOTAL; i++) {
    const p = (async () => {
      const start = performance.now()
      const resp = await fetch(baseUrl)
      await resp.text() // consume body
      const elapsed = performance.now() - start
      latencies.push(elapsed)
      completed++
    })()
    queue.push(p)

    // Control concurrency
    if (queue.length >= CONCURRENCY) {
      await Promise.race(queue)
      // Remove resolved promises
      const pending: Promise<void>[] = []
      for (const q of queue) {
        const settled = await Promise.race([q.then(() => true), Promise.resolve(false)])
        if (!settled) pending.push(q)
      }
      queue.length = 0
      queue.push(...pending)
    }
  }

  await Promise.all(queue)
  const totalMs = performance.now() - totalStart
  const memAfter = process.memoryUsage().rss

  // --- Results ---
  latencies.sort((a, b) => a - b)
  const rps = Math.round((TOTAL / totalMs) * 1000)
  const avgTTFB = latencies.reduce((a, b) => a + b, 0) / latencies.length
  const p50 = percentile(latencies, 50)
  const p95 = percentile(latencies, 95)
  const p99 = percentile(latencies, 99)
  const memDelta = memAfter - memBefore

  console.log()
  console.log("  Gorsee.js HTTP Throughput Benchmark")
  console.log("  " + "\u2500".repeat(44))
  console.log(`  Concurrency:        ${CONCURRENCY}`)
  console.log(`  Total requests:     ${fmt(TOTAL)}`)
  console.log(`  Total time:         ${(totalMs / 1000).toFixed(2)}s`)
  console.log("  " + "\u2500".repeat(44))
  console.log(`  Requests/sec:       ${fmt(rps)}`)
  console.log(`  Avg TTFB:           ${avgTTFB.toFixed(2)} ms`)
  console.log(`  P50 latency:        ${p50.toFixed(2)} ms`)
  console.log(`  P95 latency:        ${p95.toFixed(2)} ms`)
  console.log(`  P99 latency:        ${p99.toFixed(2)} ms`)
  console.log("  " + "\u2500".repeat(44))
  console.log(`  RSS before:         ${(memBefore / 1024 / 1024).toFixed(1)} MB`)
  console.log(`  RSS after:          ${(memAfter / 1024 / 1024).toFixed(1)} MB`)
  console.log(`  RSS delta:          ${(memDelta / 1024 / 1024).toFixed(1)} MB`)
  console.log("  " + "\u2500".repeat(44))
  console.log()

  server.stop()
}

runBench().catch((err) => {
  console.error(err)
  server.stop()
  process.exit(1)
})
