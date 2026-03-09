import type { ModuleAnalysisParityFixture } from "./parity.ts"

export const MODULE_ANALYSIS_FIXTURES: ModuleAnalysisParityFixture[] = [
  {
    filePath: "routes/index.tsx",
    content: `
      /** Home */
      import { Head } from "gorsee/client"
      export const meta = { title: "Home", secure: true }
      export const prerender = true
      export async function loader() { return { ok: true } }
      export default function Page() { return <main>{String(!!Head)}</main> }
    `,
  },
  {
    filePath: "routes/api/users.ts",
    content: `
      import type { Context } from "gorsee/server"
      export async function GET(_ctx: Context) { return new Response("ok") }
    `,
  },
  {
    filePath: "routes/dashboard.tsx",
    content: `
      /** Dashboard */
      import { createSignal } from "gorsee/client"
      export const meta = { area: "ops", tags: ["team"] }
      export default function Dashboard() {
        const [count] = createSignal(1)
        return <main>{count()}</main>
      }
    `,
  },
  {
    filePath: "routes/admin.tsx",
    content: `
      /** Admin */
      import Layout from "../shared/layout"
      import * as auth from "gorsee/server"
      import { Head, Link } from "gorsee/client"

      export const meta = {
        area: "admin",
        secure: true,
        tags: ["ops", "internal"],
        nested: { feature: "audit" },
      }

      export default class AdminPage {
        render() {
          return <main>{String(!!Layout && !!auth && !!Head && !!Link)}</main>
        }
      }
    `,
  },
  {
    filePath: "routes/settings.tsx",
    content: `
      /** Settings */
      import type { Context } from "gorsee/server"
      import { createSignal } from "gorsee/client"

      export const meta = {
        title: "Settings",
        sections: ["profile", "security"],
        flags: { beta: false, public: null },
      }

      export async function loader(_ctx: Context) {
        return { section: "profile" }
      }

      export default function SettingsPage() {
        const [tab] = createSignal("profile")
        return <main>{tab()}</main>
      }
    `,
  },
  {
    filePath: "routes/docs/[...parts].tsx",
    content: `
      /** Docs */
      import type { Context } from "gorsee/server"

      export const meta = {
        title: "Docs",
        sections: ["intro", "advanced"],
        flags: { public: true, beta: false, note: null },
      }

      export async function loader(_ctx: Context) {
        return { parts: ["intro"] }
      }

      export default function DocsPage() {
        return <main>docs</main>
      }
    `,
  },
  {
    filePath: "routes/reports.tsx",
    content: `
      /** Reports */
      import { Head } from "gorsee/client"
      import * as serverApi from "gorsee/server"

      export const meta = {
        title: "Reports",
        filters: ["daily", "weekly"],
        nested: { view: "table", badges: [1, 2] },
      }

      export const prerender = false

      export default function ReportsPage() {
        return <main>{String(!!Head && !!serverApi)}</main>
      }
    `,
  },
]
