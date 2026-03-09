import { Head, Link } from "gorsee/client"

export default function AboutPage() {
  return (
    <div>
      <Head>
        <title>About - My Gorsee App</title>
      </Head>
      <h1>About</h1>
      <p>This app is built with <strong>Gorsee.js</strong> — a full-stack TypeScript framework.</p>
      <Link href="/">Back to Home</Link>
    </div>
  )
}
