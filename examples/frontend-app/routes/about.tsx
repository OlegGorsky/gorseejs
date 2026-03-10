import { Head, Link } from "gorsee/client"

export const prerender = true

export default function AboutPage() {
  return (
    <section>
      <Head><title>About - Gorsee Frontend Example</title></Head>
      <h1>About This Frontend App</h1>
      <p>This example stays browser-safe: no server routes, no RPC boundary, no process runtime.</p>
      <Link href="/">Back home</Link>
    </section>
  )
}
