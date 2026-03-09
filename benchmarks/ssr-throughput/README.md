# SSR Throughput Benchmark

Measures server-side rendering performance for Gorsee.js.

## Requirements

- Bun >= 1.0

## Benchmarks

### SSR render speed (`bench:ssr`)

```sh
bun run bench:ssr          # formatted table
bun run bench:ssr --json   # machine-readable JSON
```

Renders components of varying complexity via `renderToString` and reports renders/sec, average time per render, and HTML output size.

### Bundle size analysis (`bench:size`)

```sh
bun run bench:size         # formatted table
bun run bench:size --json  # machine-readable JSON
```

Builds routes with `Bun.build()` and reports raw, gzip, and brotli sizes for framework core, per-route bundles, and CSS.

### HTTP throughput (`bench`)

```sh
bun run bench                              # defaults: 1000 requests, concurrency 50
bun run bench --requests 5000 --concurrency 100
```

Starts a minimal SSR server and fires concurrent requests. Reports requests/sec, average TTFB, P50/P95/P99 latency, and memory usage.
