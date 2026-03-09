declare const __userInputBrand: unique symbol

export type UserInput<T> = T & { readonly [__userInputBrand]: true }

export interface ValidationSchema<T> {
  parse(raw: unknown): T
}

export function validate<T>(schema: ValidationSchema<T>, raw: unknown): UserInput<T> {
  const parsed = schema.parse(raw)
  return parsed as UserInput<T>
}
