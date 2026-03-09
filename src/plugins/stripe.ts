// Stripe payments plugin -- uses native fetch, no stripe SDK dependency

import type { MiddlewareFn, Context } from "../server/middleware.ts"
import type { GorseePlugin, PluginCapability } from "./index.ts"
import { definePlugin } from "./index.ts"

export interface StripePluginConfig {
  secretKey: string
  webhookSecret?: string
}

export interface CheckoutSessionOptions {
  lineItems: Array<{ price: string; quantity: number }>
  mode?: "payment" | "subscription"
  successUrl: string
  cancelUrl: string
}

export interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

export interface StripeClient {
  createCheckoutSession(options: CheckoutSessionOptions): Promise<{ url: string; id: string }>
  verifyWebhook(request: Request): Promise<StripeEvent>
}

const STRIPE_API = "https://api.stripe.com/v1"

let stripeClient: StripeClient | null = null

/** Returns the Stripe client (available after setup) */
export function getStripe(): StripeClient {
  if (!stripeClient) {
    throw new Error("Stripe not initialized. Did you register stripePlugin?")
  }
  return stripeClient
}

function createStripeClient(config: StripePluginConfig): StripeClient {
  const authHeader = `Basic ${btoa(config.secretKey + ":")}`

  return {
    async createCheckoutSession(options) {
      const params = new URLSearchParams()
      params.set("mode", options.mode ?? "payment")
      params.set("success_url", options.successUrl)
      params.set("cancel_url", options.cancelUrl)
      options.lineItems.forEach((item, i) => {
        params.set(`line_items[${i}][price]`, item.price)
        params.set(`line_items[${i}][quantity]`, String(item.quantity))
      })

      const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Stripe API error (${res.status}): ${err}`)
      }

      const data = (await res.json()) as { url: string; id: string }
      return { url: data.url, id: data.id }
    },

    async verifyWebhook(request: Request) {
      const body = await request.text()
      const sig = request.headers.get("stripe-signature") ?? ""

      if (!config.webhookSecret) {
        throw new Error("Webhook secret not configured")
      }

      // Verify signature using HMAC-SHA256
      const encoder = new TextEncoder()
      const timestamp = sig.split(",").find((s) => s.startsWith("t="))?.slice(2) ?? ""
      const v1Sig = sig.split(",").find((s) => s.startsWith("v1="))?.slice(3) ?? ""
      const payload = `${timestamp}.${body}`

      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(config.webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      )
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
      const expected = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      if (expected !== v1Sig) {
        throw new Error("Invalid webhook signature")
      }

      return JSON.parse(body) as StripeEvent
    },
  }
}

/** Creates a Stripe payments plugin */
export function stripePlugin(config: StripePluginConfig): GorseePlugin {
  const capabilities: PluginCapability[] = ["payments"]
  if (config.webhookSecret) capabilities.push("routes")

  return definePlugin({
    name: "gorsee-stripe",
    capabilities,

    async setup(app) {
      stripeClient = createStripeClient(config)

      // Register webhook route if webhook secret is configured
      if (config.webhookSecret) {
        app.addRoute("/api/stripe/webhook", async (ctx) => {
          try {
            const event = await stripeClient!.verifyWebhook(ctx.request)
            return new Response(JSON.stringify({ received: true, type: event.type }), {
              headers: { "Content-Type": "application/json" },
            })
          } catch (err) {
            return new Response(JSON.stringify({ error: String(err) }), { status: 400 })
          }
        })
      }
    },

    async teardown() {
      stripeClient = null
    },
  })
}
