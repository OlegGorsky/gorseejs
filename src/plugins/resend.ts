// Resend email plugin -- uses native fetch, no SDK dependency

import type { GorseePlugin } from "./index.ts"
import { definePlugin } from "./index.ts"

export interface ResendPluginConfig {
  apiKey: string
  from?: string
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
}

export interface Mailer {
  send(options: SendEmailOptions): Promise<{ id: string }>
}

const RESEND_API = "https://api.resend.com"

let mailerInstance: Mailer | null = null

/** Returns the mailer instance (available after setup) */
export function getMailer(): Mailer {
  if (!mailerInstance) {
    throw new Error("Resend not initialized. Did you register resendPlugin?")
  }
  return mailerInstance
}

function createMailer(config: ResendPluginConfig): Mailer {
  return {
    async send(options: SendEmailOptions): Promise<{ id: string }> {
      const body = {
        from: options.from ?? config.from ?? "onboarding@resend.dev",
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        ...(options.html ? { html: options.html } : {}),
        ...(options.text ? { text: options.text } : {}),
      }

      const res = await fetch(`${RESEND_API}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Resend API error (${res.status}): ${err}`)
      }

      return (await res.json()) as { id: string }
    },
  }
}

/** Creates a Resend email plugin */
export function resendPlugin(config: ResendPluginConfig): GorseePlugin {
  return definePlugin({
    name: "gorsee-resend",
    capabilities: ["email"],

    async setup() {
      mailerInstance = createMailer(config)
    },

    async teardown() {
      mailerInstance = null
    },
  })
}
