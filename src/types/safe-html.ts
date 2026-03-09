declare const __safeHTMLBrand: unique symbol

export type SafeHTMLValue = string & { readonly [__safeHTMLBrand]: true }

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
}

const ESCAPE_RE = /[&<>"']/g

export function sanitize(raw: string): SafeHTMLValue {
  const escaped = raw.replace(ESCAPE_RE, (ch) => ESCAPE_MAP[ch] ?? ch)
  return escaped as SafeHTMLValue
}

export function SafeHTML(
  strings: TemplateStringsArray,
  ...values: unknown[]
): SafeHTMLValue {
  const parts: string[] = []
  for (let i = 0; i < strings.length; i++) {
    parts.push(strings[i]!)
    if (i < values.length) {
      parts.push(sanitize(String(values[i])) as string)
    }
  }
  return parts.join("") as SafeHTMLValue
}
