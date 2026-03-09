import { Head, Link } from "gorsee/client"

export default function NotFoundPage() {
  return (
    <div>
      <Head><title>404 - Not Found</title></Head>
      <h1>404</h1>
      <p>The page you're looking for doesn't exist.</p>
      <Link href="/">Go back home</Link>
    </div>
  )
}
