// Stable forms-focused public surface.
// Prefer this subpath when form contracts are the primary concern.

export { useFormAction, type FormActionResult, type FormState, type FormSubmitOptions } from "../runtime/form.ts"
export { actionFailure, actionSuccess, type ActionResult } from "../server/action.ts"
export {
  defineFormAction,
  type DefineFormActionOptions,
  type FormActionContext,
} from "./action.ts"
export {
  defineForm,
  validateForm,
  validateAction,
  toFieldErrors,
  fieldAttrs,
  type FormField,
  type FormSchema,
  type ValidationResult,
  type ActionValidationResult,
  type ValidationError,
} from "../runtime/validated-form.ts"
