import { Head, Link } from "gorsee/client"

export default function PluginStackHomePage() {
  return (
    <>
      <Head><title>Plugin Stack</title></Head>
      <main>
        <h1>Plugin Stack</h1>
        <p>Stable plugin contracts stay visible through a mature product proof surface.</p>
        <Link href="/api/plugins">Plugin health</Link>
      </main>
    </>
  )
}
