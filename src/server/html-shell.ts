export interface HTMLWrapOptions {
  title?: string
  clientScript?: string
  loaderData?: unknown
  params?: Record<string, string>
  cssFiles?: string[]
  headElements?: string[]
  bodyPrefix?: string[]
  bodySuffix?: string[]
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

export function wrapHTML(
  body: string,
  nonce: string | undefined,
  options: HTMLWrapOptions = {},
): string {
  const {
    title = "Gorsee App",
    clientScript,
    loaderData,
    params,
    cssFiles = [],
    headElements = [],
    bodyPrefix = [],
    bodySuffix = [],
  } = options

  let dataScript = ""
  if (loaderData !== undefined) {
    const json = JSON.stringify(loaderData).replace(/</g, "\\u003c")
    dataScript = `\n  <script id="__GORSEE_DATA__" type="application/json"${renderNonceAttr(nonce)}>${json}</script>`
  }

  let paramsScript = ""
  if (params && Object.keys(params).length > 0) {
    paramsScript = `\n  <script${renderNonceAttr(nonce)}>window.__GORSEE_PARAMS__=${JSON.stringify(params)}</script>`
  }

  const clientTag = clientScript
    ? `\n  <script type="module" src="${clientScript}"${renderNonceAttr(nonce)}></script>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="stylesheet" href="/styles.css" />
${cssFiles.map((file) => `  <link rel="stylesheet" href="${file}" />`).join("\n")}
${headElements.join("\n")}
</head>
<body>
${bodyPrefix.join("\n")}
  <div id="app">${body}</div>${dataScript}${paramsScript}${clientTag}
${bodySuffix.join("\n")}
</body>
</html>`
}

function renderNonceAttr(nonce?: string): string {
  return nonce ? ` nonce="${nonce}"` : ""
}
