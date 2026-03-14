import { Head, Link } from "gorsee/client"
import { createTypedRoute } from "gorsee/routes"

const dashboardRoute = createTypedRoute("/app/dashboard")
const billingRoute = createTypedRoute("/app/billing")

export default function HomePage() {
  return (
    <>
      <Head><title>Secure SaaS</title></Head>
      <main>
        <h1>Secure SaaS</h1>
        <p>Canonical fullstack SaaS example with protected routes, typed navigation, validated billing mutations, and RPC middleware boundaries.</p>
        <nav>
          <ul>
            <li><Link href={dashboardRoute}>Open dashboard</Link></li>
            <li><Link href={billingRoute}>Open billing settings</Link></li>
          </ul>
        </nav>
        <section>
          <h2>Proof surface</h2>
          <ul>
            <li>Private route cache enforced at the protected app group.</li>
            <li>RPC requests are protected separately through `security.rpc.middlewares`.</li>
            <li>Billing changes use `gorsee/forms` validation instead of ad hoc request parsing.</li>
          </ul>
        </section>
      </main>
    </>
  )
}
