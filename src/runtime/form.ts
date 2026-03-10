import { createSignal, type SignalGetter } from "../reactive/signal.ts"

export interface FormActionResult<T = unknown> {
  ok?: boolean
  status?: number
  data?: T
  error?: string
  fieldErrors?: Record<string, string[]>
  formErrors?: string[]
  values?: Record<string, string>
}

export interface FormSubmitOptions<T = unknown> {
  optimisticData?: T
}

export interface FormState<T = unknown> {
  submitting: SignalGetter<boolean>
  status: SignalGetter<"idle" | "submitting" | "success" | "error">
  error: SignalGetter<string | undefined>
  formErrors: SignalGetter<string[]>
  fieldErrors: SignalGetter<Record<string, string[]>>
  data: SignalGetter<T | undefined>
  submit: (formData: FormData | Record<string, string>, options?: FormSubmitOptions<T>) => Promise<FormActionResult<T>>
  reset: () => void
}

function isPlainFormActionResult(value: unknown): value is FormActionResult<unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeFormInput(input: FormData | Record<string, string>): FormData | URLSearchParams {
  return input instanceof FormData ? input : new URLSearchParams(input)
}

export function useFormAction<T = unknown>(actionUrl?: string): FormState<T> {
  const [submitting, setSubmitting] = createSignal(false)
  const [status, setStatus] = createSignal<"idle" | "submitting" | "success" | "error">("idle")
  const [error, setError] = createSignal<string | undefined>(undefined)
  const [formErrors, setFormErrors] = createSignal<string[]>([])
  const [fieldErrors, setFieldErrors] = createSignal<Record<string, string[]>>({})
  const [data, setData] = createSignal<T | undefined>(undefined)

  function reset(): void {
    setSubmitting(false)
    setStatus("idle")
    setError(undefined)
    setFormErrors([])
    setFieldErrors({})
    setData(undefined)
  }

  async function submit(
    input: FormData | Record<string, string>,
    options: FormSubmitOptions<T> = {},
  ): Promise<FormActionResult<T>> {
    setSubmitting(true)
    setStatus("submitting")
    setError(undefined)
    setFormErrors([])
    setFieldErrors({})
    if (options.optimisticData !== undefined) {
      setData(() => options.optimisticData)
    }

    try {
      const url = actionUrl ?? location.pathname
      const res = await fetch(url, {
        method: "POST",
        body: normalizeFormInput(input),
        headers: {
          "Accept": "application/json",
        },
      })

      const decoded = await res.json() as unknown
      if (!isPlainFormActionResult(decoded)) {
        throw new Error("Malformed form action response")
      }
      const rawResult = decoded as FormActionResult<T>
      const result: FormActionResult<T> = {
        ok: rawResult.ok ?? res.ok,
        status: rawResult.status ?? res.status,
        data: rawResult.data,
        error: rawResult.error,
        fieldErrors: rawResult.fieldErrors,
        formErrors: rawResult.formErrors,
        values: rawResult.values,
      }

      if (result.ok === false || result.error || (result.formErrors && result.formErrors.length > 0) || (result.fieldErrors && Object.keys(result.fieldErrors).length > 0)) {
        setStatus("error")
        setError(result.error)
        setFormErrors(result.formErrors ?? [])
        setFieldErrors(result.fieldErrors ?? {})
        return result
      }

      setStatus("success")
      setData(() => result.data)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus("error")
      setError(message)
      return { ok: false, status: 500, error: message }
    } finally {
      setSubmitting(false)
    }
  }

  return { submitting, status, error, formErrors, fieldErrors, data, submit, reset }
}
