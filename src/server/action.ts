// Server Actions -- form mutations with progressive enhancement
// Usage in route:
//   export const action = defineAction(async (ctx) => { ... })
//
// Client-side: submits via fetch, returns result
// SSR: handles POST form submissions with redirect

import type { Context } from "./middleware.ts"

export interface ActionResult<T = unknown> {
  ok: boolean
  status: number
  data?: T
  error?: string
  fieldErrors?: Record<string, string[]>
  formErrors?: string[]
  values?: Record<string, string>
}

export type ActionReturn<T = unknown> = T | Response | ActionResult<T>
export type ActionFn<T = unknown> = (ctx: Context) => Promise<ActionReturn<T>>

function isActionResult<T>(value: unknown): value is ActionResult<T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  if ("status" in value || "error" in value || "fieldErrors" in value || "formErrors" in value || "values" in value) {
    return true
  }
  return "ok" in value && value.ok === false
}

export function actionSuccess<T>(
  data?: T,
  init: Omit<Partial<ActionResult<T>>, "ok" | "data"> & { status?: number } = {},
): ActionResult<T> {
  return {
    ok: true,
    status: init.status ?? 200,
    data,
    error: init.error,
    fieldErrors: init.fieldErrors,
    formErrors: init.formErrors,
    values: init.values,
  }
}

export function actionFailure<T = never>(
  error: string,
  init: Omit<Partial<ActionResult<T>>, "ok" | "error"> & { status?: number } = {},
): ActionResult<T> {
  return {
    ok: false,
    status: init.status ?? 400,
    data: init.data,
    error,
    fieldErrors: init.fieldErrors,
    formErrors: init.formErrors,
    values: init.values,
  }
}

function normalizeActionResult<T>(result: ActionResult<T>): ActionResult<T> {
  const status = result.status ?? (result.ok === false || result.error ? 400 : 200)
  const ok = result.ok ?? (status < 400 && !result.error)
  return {
    ok,
    status,
    data: result.data,
    error: result.error,
    fieldErrors: result.fieldErrors,
    formErrors: result.formErrors,
    values: result.values,
  }
}

export function defineAction<T = unknown>(fn: ActionFn<T>): ActionFn<T> {
  return fn
}

export async function handleAction<T>(
  actionFn: ActionFn<T>,
  ctx: Context,
): Promise<ActionResult<T>> {
  try {
    const result = await actionFn(ctx)
    if (result instanceof Response) {
      return { ok: result.ok, status: result.status }
    }
    if (isActionResult<T>(result)) {
      return normalizeActionResult(result)
    }
    return actionSuccess(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return actionFailure(message, { status: 500 })
  }
}

// Parse form data from request into a typed object
export async function parseFormData(request: Request): Promise<Record<string, string>> {
  const formData = await request.formData()
  const result: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      result[key] = value
    }
  }
  return result
}
