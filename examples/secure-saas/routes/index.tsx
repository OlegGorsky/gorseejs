import { Head, Link } from "gorsee/client"

export default function HomePage() {
  return (
    <>
      <Head><title>Secure SaaS</title></Head>
      <main>
        <h1>Secure SaaS</h1>
        <Link href="/app/dashboard">Dashboard</Link>
      </main>
    </>
  )
}
