# Gorsee.js DOM Benchmark

js-framework-benchmark compatible implementation for Gorsee.js.

Tests raw DOM performance: creating, updating, swapping, selecting, and deleting rows in a table, following the format of Stefan Krause's js-framework-benchmark.

## Visual mode (dev server)

```bash
bun run dev
```

Opens the interactive benchmark page with buttons for each operation.

## Automated benchmark (signal operations)

```bash
bun run bench          # formatted table output
bun run bench --json   # machine-readable JSON
```

Measures pure signal/data operation times in Bun (no DOM).

## Operations

| Button | Action |
|--------|--------|
| Create 1,000 rows | Replace data with 1k rows |
| Create 10,000 rows | Replace data with 10k rows |
| Append 1,000 rows | Add 1k rows to existing |
| Update every 10th row | Append " !!!" to every 10th label |
| Clear | Remove all rows |
| Swap Rows | Swap rows at index 1 and 998 |
