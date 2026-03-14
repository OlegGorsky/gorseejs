import { Head, Link } from "gorsee/client"
import { createTypedRoute } from "gorsee/routes"

const dashboardRoute = createTypedRoute("/app/dashboard")
const billingRoute = createTypedRoute("/app/billing")
const teamRoute = createTypedRoute("/app/team")

export default function HomePage() {
  return (
    <>
      <Head><title>Secure SaaS</title></Head>
      <main>
        <h1>Secure SaaS</h1>
        <p>Canonical fullstack SaaS example with protected routes, typed navigation, validated billing and team-governance mutations, and RPC middleware boundaries.</p>
        <nav>
          <ul>
            <li><Link href={dashboardRoute}>Open dashboard</Link></li>
            <li><Link href={billingRoute}>Open billing settings</Link></li>
            <li><Link href={teamRoute}>Open team access controls</Link></li>
          </ul>
        </nav>
        <section>
          <h2>Proof surface</h2>
          <ul>
            <li>Private route cache enforced at the protected app group.</li>
            <li>RPC requests are protected separately through `security.rpc.middlewares`.</li>
            <li>Billing changes use `gorsee/forms` validation instead of ad hoc request parsing.</li>
            <li>Team invites and role policy stay server-validated inside the protected app shell.</li>
          </ul>
        </section>
      </main>
    </>
  )
}
