declare const __safeSQLBrand: unique symbol

export interface SafeSQLValue {
  readonly text: string
  readonly params: readonly unknown[]
  readonly [__safeSQLBrand]: true
}

export function SafeSQL(
  strings: TemplateStringsArray,
  ...values: unknown[]
): SafeSQLValue {
  const parts: string[] = []
  const params: unknown[] = []

  for (let i = 0; i < strings.length; i++) {
    parts.push(strings[i]!)
    if (i < values.length) {
      params.push(values[i])
      parts.push("?")
    }
  }

  return {
    text: parts.join(""),
    params,
  } as unknown as SafeSQLValue
}
