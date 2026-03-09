export type FormFieldKind = "string" | "number" | "boolean" | "json"

export interface FieldRule<T = unknown> {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  min?: number
  max?: number
  custom?: (value: T, data: Record<string, unknown>) => string | null
}

export interface FormField<TName extends string = string, TValue = string> {
  name: TName
  rules: FieldRule<TValue>
  label?: string
  kind?: FormFieldKind
  coerce?: (value: string | undefined) => TValue
}

export interface FormSchema<TData extends Record<string, unknown> = Record<string, unknown>> {
  fields: FormField[]
  formRules?: Array<(data: Partial<TData>) => ValidationError | null>
}

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult<T> {
  valid: boolean
  data: T | null
  errors: ValidationError[]
  fieldErrors: Record<string, string[]>
  formErrors: string[]
}

export interface ActionValidationResult<T> extends ValidationResult<T> {
  values: Record<string, string>
}

export function defineForm<TData extends Record<string, unknown> = Record<string, unknown>>(
  fields: FormField[],
  options: Pick<FormSchema<TData>, "formRules"> = {},
): FormSchema<TData> {
  return { fields, formRules: options.formRules ?? [] }
}

function coerceFieldValue(field: FormField, value: string | undefined): unknown {
  if (field.coerce) return field.coerce(value)
  const raw = value ?? ""
  const inferredKind: FormFieldKind | undefined = field.kind ?? (
    field.rules.min !== undefined || field.rules.max !== undefined ? "number" : undefined
  )

  switch (inferredKind) {
    case "number":
      return raw === "" ? undefined : Number(raw)
    case "boolean":
      return raw === "true" || raw === "on" || raw === "1"
    case "json":
      return raw === "" ? undefined : JSON.parse(raw)
    default:
      return raw
  }
}

function validateField(rawValue: string | undefined, field: FormField, data: Record<string, unknown>): ValidationError | null {
  const { rules, label } = field
  const name = label ?? field.name
  const raw = rawValue ?? ""

  if (rules.required && !raw.trim()) return { field: field.name, message: `${name} is required` }
  if (!raw && !rules.required) return null
  if (rules.minLength !== undefined && raw.length < rules.minLength) {
    return { field: field.name, message: `${name} must be at least ${rules.minLength} characters` }
  }
  if (rules.maxLength !== undefined && raw.length > rules.maxLength) {
    return { field: field.name, message: `${name} must be at most ${rules.maxLength} characters` }
  }
  if (rules.pattern && !rules.pattern.test(raw)) {
    return { field: field.name, message: `${name} format is invalid` }
  }

  const coerced = coerceFieldValue(field, rawValue)
  if (rules.min !== undefined && typeof coerced === "number" && coerced < rules.min) {
    return { field: field.name, message: `${name} must be at least ${rules.min}` }
  }
  if (rules.max !== undefined && typeof coerced === "number" && coerced > rules.max) {
    return { field: field.name, message: `${name} must be at most ${rules.max}` }
  }
  if (rules.custom) {
    const message = rules.custom(coerced as never, data)
    if (message) return { field: field.name, message }
  }
  return null
}

export function toFieldErrors(errors: ValidationError[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}
  for (const error of errors) {
    const key = error.field || "$form"
    grouped[key] ??= []
    grouped[key].push(error.message)
  }
  return grouped
}

export function validateForm<T extends Record<string, unknown>>(
  data: Record<string, string>,
  schema: FormSchema<T>,
): ValidationResult<T> {
  const errors: ValidationError[] = []
  const coercedData: Record<string, unknown> = {}

  for (const field of schema.fields) {
    const raw = data[field.name]
    const error = validateField(raw, field, coercedData)
    if (error) {
      errors.push(error)
      continue
    }

    const coerced = coerceFieldValue(field, raw)
    if (coerced !== undefined) {
      coercedData[field.name] = coerced
    } else if (raw !== undefined && field.kind === undefined && field.rules.min === undefined && field.rules.max === undefined) {
      coercedData[field.name] = raw
    }
  }

  if (errors.length === 0) {
    for (const rule of schema.formRules ?? []) {
      const error = rule(coercedData as Partial<T>)
      if (error) errors.push(error)
    }
  }

  const fieldErrors = toFieldErrors(errors.filter((error) => error.field !== "$form"))
  const formErrors = errors.filter((error) => error.field === "$form").map((error) => error.message)

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? (coercedData as T) : null,
    errors,
    fieldErrors,
    formErrors,
  }
}

function normalizeInput(input: FormData | Record<string, string>): Record<string, string> {
  if (input instanceof FormData) {
    const data: Record<string, string> = {}
    input.forEach((value, key) => {
      data[key] = String(value)
    })
    return data
  }
  return input
}

export async function validateAction<T extends Record<string, unknown>>(
  request: Request,
  schema: FormSchema<T>,
): Promise<ActionValidationResult<T>> {
  const contentType = request.headers.get("content-type") ?? ""
  let data: Record<string, string>

  if (contentType.includes("application/json")) {
    const json = await request.json() as Record<string, unknown>
    data = Object.fromEntries(Object.entries(json).map(([key, value]) => [key, String(value ?? "")]))
  } else {
    data = normalizeInput(await request.formData())
  }

  const result = validateForm<T>(data, schema)
  return { ...result, values: data }
}

export function fieldAttrs(field: FormField): Record<string, unknown> {
  const attrs: Record<string, unknown> = { name: field.name }
  if (field.rules.required) attrs.required = true
  if (field.rules.minLength !== undefined) attrs.minlength = field.rules.minLength
  if (field.rules.maxLength !== undefined) attrs.maxlength = field.rules.maxLength
  if (field.rules.pattern) attrs.pattern = field.rules.pattern.source
  if (field.rules.min !== undefined) attrs.min = field.rules.min
  if (field.rules.max !== undefined) attrs.max = field.rules.max
  if (field.kind === "number" || field.rules.min !== undefined || field.rules.max !== undefined) attrs.inputmode = "numeric"
  if (field.kind === "boolean") attrs.value = "true"
  return attrs
}
