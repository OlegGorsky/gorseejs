import { Head } from "gorsee/client"
import { actionSuccess, defineForm, defineFormAction, fieldAttrs } from "gorsee/forms"
import type { Context } from "gorsee/server"

type TeamData = Record<string, unknown> & {
  user: string
  inviteBudget: number
  pendingApprovals: number
  teamMembers: Array<{
    name: string
    role: string
    region: string
    access: string
  }>
}

interface TeamInviteResult {
  invited: boolean
  email: string
  role: string
  region: string
  accessWindow: string
}

const teamInviteForm = defineForm<{
  email: string
  role: string
  region: string
  accessWindow: string
  requiresApproval: boolean
}>([
  {
    name: "email",
    label: "Invite email",
    rules: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
  },
  {
    name: "role",
    label: "Role",
    rules: {
      required: true,
      custom: (value) => (
        value === "owner" || value === "admin" || value === "support" || value === "analyst"
          ? null
          : "Role must be owner, admin, support, or analyst."
      ),
    },
  },
  {
    name: "region",
    label: "Region",
    rules: {
      required: true,
      custom: (value) => (
        value === "eu" || value === "us" || value === "apac"
          ? null
          : "Region must be eu, us, or apac."
      ),
    },
  },
  {
    name: "accessWindow",
    label: "Access window",
    rules: {
      required: true,
      custom: (value) => (
        value === "always-on" || value === "business-hours" || value === "incident-only"
          ? null
          : "Access window must be always-on, business-hours, or incident-only."
      ),
    },
  },
  {
    name: "requiresApproval",
    label: "Requires approval",
    kind: "boolean",
    rules: {},
  },
], {
  formRules: [
    (data) => (
      data.role === "owner" && data.requiresApproval !== true
        ? { field: "$form", message: "Owner invites require explicit approval." }
        : null
    ),
    (data) => (
      data.region === "apac" && data.accessWindow === "always-on"
        ? { field: "$form", message: "APAC access must be scoped to business-hours or incident-only." }
        : null
    ),
  ],
})

export function load(ctx: Context): TeamData {
  const session = ctx.locals.session as { userId?: string } | undefined
  return {
    user: session?.userId ?? "guest",
    inviteBudget: 8,
    pendingApprovals: 2,
    teamMembers: [
      { name: "Nadia", role: "admin", region: "eu", access: "business-hours" },
      { name: "Sam", role: "support", region: "us", access: "always-on" },
      { name: "Ivy", role: "analyst", region: "eu", access: "incident-only" },
    ],
  }
}

export const action = defineFormAction(teamInviteForm, async ({ data }) => {
  return actionSuccess<TeamInviteResult>({
    invited: true,
    email: data.email,
    role: data.role,
    region: data.region,
    accessWindow: data.accessWindow,
  })
})

export default function TeamPage(props: { data: TeamData }) {
  return (
    <main>
      <Head><title>Secure SaaS Team Access</title></Head>
      <h1>Team Access Controls</h1>
      <p>Operator: <strong>{props.data.user}</strong></p>
      <p>Invite budget remaining this cycle: {props.data.inviteBudget}</p>
      <p>Pending approvals: {props.data.pendingApprovals}</p>
      <section>
        <h2>Current Team Policy</h2>
        <ul>
          {props.data.teamMembers.map((member) => (
            <li>{member.name} — {member.role} — {member.region} — {member.access}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Invite Workflow</h2>
        <form method="POST">
          <p>
            <label>
              Invite email
              <input type="email" value="new-operator@acme.example" {...fieldAttrs(teamInviteForm.fields[0]!)} />
            </label>
          </p>
          <p>
            <label>
              Role
              <input type="text" value="support" {...fieldAttrs(teamInviteForm.fields[1]!)} />
            </label>
          </p>
          <p>
            <label>
              Region
              <input type="text" value="eu" {...fieldAttrs(teamInviteForm.fields[2]!)} />
            </label>
          </p>
          <p>
            <label>
              Access window
              <input type="text" value="business-hours" {...fieldAttrs(teamInviteForm.fields[3]!)} />
            </label>
          </p>
          <p>
            <label>
              <input type="checkbox" checked={true} {...fieldAttrs(teamInviteForm.fields[4]!)} />
              Require approval before invite activation
            </label>
          </p>
          <button type="submit">Queue invite</button>
        </form>
        <p>
          This route demonstrates a protected team-governance mutation surface with form-level policy checks,
          not just a single billing form.
        </p>
      </section>
    </main>
  )
}
