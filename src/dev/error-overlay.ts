// Dev error overlay -- styled error page with source context

import { escapeHTML } from "../runtime/html-escape.ts"

export function renderErrorOverlay(error: Error | string, nonce: string): string {
  const message = typeof error === "string" ? error : error.message
  const stack = typeof error === "string" ? "" : error.stack ?? ""

  // Parse stack to extract file:line
  const stackLines = stack.split("\n").slice(1)
  const frames = stackLines.map((line) => {
    const match = line.match(/at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/)
    if (match) return { fn: match[1], file: match[2], line: match[3], col: match[4] }
    const match2 = line.match(/at\s+(.+):(\d+):(\d+)/)
    if (match2) return { fn: "(anonymous)", file: match2[1], line: match2[2], col: match2[3] }
    return null
  }).filter(Boolean)

  const framesHTML = frames.map((f) =>
    `<div class="g-frame"><span class="g-fn">${escapeHTML(f!.fn!)}</span> <span class="g-loc">${escapeHTML(f!.file!)}:${f!.line}</span></div>`
  ).join("")

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Error - Gorsee Dev</title>
<style nonce="${nonce}">
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#1a1a2e;color:#e0e0e0;padding:2rem}
.g-overlay{max-width:900px;margin:0 auto}
.g-title{color:#ff6b6b;font-size:1.4rem;margin-bottom:1rem}
.g-message{background:#16213e;border:1px solid #ff6b6b33;border-radius:8px;padding:1.2rem;margin-bottom:1.5rem;font-size:1rem;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.g-stack{margin-bottom:1.5rem}
.g-stack-title{color:#888;font-size:.85rem;margin-bottom:.5rem}
.g-frame{padding:.4rem .8rem;border-radius:4px;margin-bottom:2px;font-size:.85rem}
.g-frame:hover{background:#16213e}
.g-fn{color:#64b5f6}
.g-loc{color:#888}
.g-hint{background:#16213e;border:1px solid #333;border-radius:8px;padding:1rem;color:#aaa;font-size:.85rem;line-height:1.5}
.g-hint a{color:#64b5f6}
</style>
</head>
<body>
<div class="g-overlay">
  <div class="g-title">Runtime Error</div>
  <div class="g-message">${escapeHTML(message)}</div>
  ${frames.length ? `<div class="g-stack"><div class="g-stack-title">Stack Trace</div>${framesHTML}</div>` : ""}
  <div class="g-hint">
    This error occurred during server-side rendering.<br>
    Fix the error and the page will auto-reload.
  </div>
</div>
</body>
</html>`
}
