import { Head, Link, createSignal, island } from "gorsee/client"
import { createTypedRoute } from "gorsee/routes"
import { server, type Context } from "gorsee/server"

const billingRoute = createTypedRoute("/app/billing")

interface DashboardData {
  user: string
  plan: string
  activeSeats: number
  pendingInvites: number
  privateCacheMode: string
}

const refreshWorkspaceSnapshot = server(async (activeSeats: number, pendingInvites: number) => {
  return {
    activeSeats: activeSeats + 1,
    pendingInvites: Math.max(0, pendingInvites - 1),
    updatedAt: "protected-rpc-refresh",
  }
})

const WorkspaceSnapshotCard = island(function WorkspaceSnapshotCard(props: {
  activeSeats: number
  pendingInvites: number
}) {
  const [activeSeats, setActiveSeats] = createSignal(props.activeSeats)
  const [pendingInvites, setPendingInvites] = createSignal(props.pendingInvites)
  const [status, setStatus] = createSignal("Server-rendered snapshot")

  async function refresh(): Promise<void> {
    setStatus("Refreshing protected snapshot...")
    const next = await refreshWorkspaceSnapshot(activeSeats(), pendingInvites())
    setActiveSeats(next.activeSeats)
    setPendingInvites(next.pendingInvites)
    setStatus(`Updated via ${next.updatedAt}`)
  }

  return (
    <section>
      <h2>Workspace Snapshot</h2>
      <p>Active seats: {activeSeats()}</p>
      <p>Pending invites: {pendingInvites()}</p>
      <p>{status()}</p>
      <button type="button" on:click={() => { void refresh() }}>Refresh via protected RPC</button>
    </section>
  )
})

export async function load(ctx: Context): Promise<DashboardData> {
  const session = ctx.locals.session as { userId?: string } | undefined
  return {
    user: session?.userId ?? "guest",
    plan: "Growth",
    activeSeats: 12,
    pendingInvites: 3,
    privateCacheMode: "private",
  }
}

export default function DashboardPage(props: { data: DashboardData }) {
  return (
    <main>
      <Head><title>Secure SaaS Dashboard</title></Head>
      <h1>Dashboard</h1>
      <p>Signed in as: <strong>{props.data.user}</strong></p>
      <ul>
        <li>Plan: {props.data.plan}</li>
        <li>Cache mode: {props.data.privateCacheMode}</li>
        <li>RPC boundary: protected in `app.config.ts` via `security.rpc.middlewares`</li>
      </ul>
      <WorkspaceSnapshotCard
        activeSeats={props.data.activeSeats}
        pendingInvites={props.data.pendingInvites}
      />
      <p>
        <Link href={billingRoute}>Manage billing and seat policy</Link>
      </p>
    </main>
  )
}
