import type { SafeSQLValue } from "../types/safe-sql.ts"
import type { SafeHTMLValue } from "../types/safe-html.ts"

/**
 * DANGER: Bypasses SQL safety. Only use when you know the string is safe.
 * This function exists as an explicit escape hatch -- its name signals danger.
 */
export function unsafeSQL(raw: string): SafeSQLValue {
  return { text: raw, params: [] } as unknown as SafeSQLValue
}

/**
 * DANGER: Bypasses HTML sanitization. Only use for trusted content.
 * This function exists as an explicit escape hatch -- its name signals danger.
 */
export function unsafeHTML(raw: string): SafeHTMLValue {
  return raw as unknown as SafeHTMLValue
}
