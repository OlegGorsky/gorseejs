import { actionFailure, defineAction, type ActionFn, type ActionReturn, type ActionResult } from "../server/action.ts"
import type { Context } from "../server/middleware.ts"
import { validateAction, type ActionValidationResult, type FormSchema } from "../runtime/validated-form.ts"

export interface FormActionContext<TData extends Record<string, unknown>> {
  ctx: Context
  data: TData
  values: Record<string, string>
  validation: ActionValidationResult<TData>
}

export interface DefineFormActionOptions {
  invalidMessage?: string
  invalidStatus?: number
}

export function defineFormAction<TData extends Record<string, unknown>, TResult = unknown>(
  schema: FormSchema<TData>,
  handler: (input: FormActionContext<TData>) => Promise<ActionReturn<TResult>>,
  options: DefineFormActionOptions = {},
): ActionFn<TResult> {
  return defineAction(async (ctx) => {
    const validation = await validateAction(ctx.request, schema)
    if (!validation.valid || !validation.data) {
      return actionFailure(options.invalidMessage ?? "Validation failed", {
        status: options.invalidStatus ?? 400,
        fieldErrors: validation.fieldErrors,
        formErrors: validation.formErrors,
        values: validation.values,
      })
    }

    return handler({
      ctx,
      data: validation.data,
      values: validation.values,
      validation,
    })
  })
}

export type { ActionResult }
