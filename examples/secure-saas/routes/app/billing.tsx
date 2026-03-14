import { Head, island, useFormAction } from "gorsee/client"
import { actionSuccess, defineForm, defineFormAction, fieldAttrs } from "gorsee/forms"
import type { Context } from "gorsee/server"

type BillingData = Record<string, unknown> & {
  user: string
  invoiceEmail: string
  seats: number
  autoRecharge: boolean
  plan: string
}

interface BillingActionData {
  saved: boolean
  invoiceEmail: string
  seats: number
  autoRecharge: boolean
  plan: string
}

const billingForm = defineForm<{
  invoiceEmail: string
  seats: number
  autoRecharge: boolean
}>([
  {
    name: "invoiceEmail",
    label: "Invoice email",
    rules: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
  },
  {
    name: "seats",
    label: "Seats",
    kind: "number",
    rules: {
      required: true,
      min: 1,
      max: 250,
    },
  },
  {
    name: "autoRecharge",
    label: "Auto recharge",
    kind: "boolean",
    rules: {},
  },
], {
  formRules: [
    (data) => (
      typeof data.seats === "number" && data.seats > 50 && data.autoRecharge !== true
        ? { field: "$form", message: "Auto recharge is required when seat count is above 50." }
        : null
    ),
  ],
})

const BillingSettingsForm = island<BillingData>(function BillingSettingsForm(props: BillingData) {
  const billingAction = useFormAction<BillingActionData>("/app/billing")

  async function submit(event: Event): Promise<void> {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    await billingAction.submit(new FormData(form))
  }

  return (
    <section>
      <h2>Billing Controls</h2>
      <form method="POST" action="/app/billing" on:submit={(event) => { void submit(event) }}>
        <p>
          <label>
            Invoice email
            <input
              type="email"
              value={props.invoiceEmail}
              {...fieldAttrs(billingForm.fields[0]!)}
            />
          </label>
        </p>
        <p>
          <label>
            Seats
            <input
              type="number"
              value={String(props.seats)}
              {...fieldAttrs(billingForm.fields[1]!)}
            />
          </label>
        </p>
        <p>
          <label>
            <input
              type="checkbox"
              checked={props.autoRecharge}
              {...fieldAttrs(billingForm.fields[2]!)}
            />
            Enable auto recharge
          </label>
        </p>
        <button type="submit" disabled={billingAction.submitting()}>
          {billingAction.submitting() ? "Saving..." : "Save billing policy"}
        </button>
      </form>
      {billingAction.error() && <p>Request error: {billingAction.error()}</p>}
      {billingAction.formErrors().length > 0 && (
        <ul>
          {billingAction.formErrors().map((message) => <li>{message}</li>)}
        </ul>
      )}
      {Object.keys(billingAction.fieldErrors()).length > 0 && (
        <ul>
          {Object.entries(billingAction.fieldErrors()).map(([field, messages]) => (
            <li>{field}: {messages.join(", ")}</li>
          ))}
        </ul>
      )}
      {billingAction.data() && (
        <p>
          Saved plan {billingAction.data()!.plan} for {billingAction.data()!.seats} seats.
        </p>
      )}
    </section>
  )
})

export function load(ctx: Context): BillingData {
  const session = ctx.locals.session as { userId?: string } | undefined
  return {
    user: session?.userId ?? "guest",
    invoiceEmail: "finance@acme.example",
    seats: 12,
    autoRecharge: false,
    plan: "Growth",
  }
}

export const action = defineFormAction(billingForm, async ({ data }) => {
  const plan = data.seats >= 25 ? "Scale" : "Growth"
  return actionSuccess({
    saved: true,
    invoiceEmail: data.invoiceEmail,
    seats: data.seats,
    autoRecharge: data.autoRecharge,
    plan,
  })
})

export default function BillingPage(props: { data: BillingData }) {
  return (
    <main>
      <Head><title>Secure SaaS Billing</title></Head>
      <h1>Billing Settings</h1>
      <p>Operator: <strong>{props.data.user}</strong></p>
      <p>Current plan: {props.data.plan}</p>
      <p>This route demonstrates server-validated form actions with client-side progressive enhancement.</p>
      <BillingSettingsForm {...props.data} />
    </main>
  )
}
