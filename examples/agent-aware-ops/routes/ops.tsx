import { Head } from "gorsee/client"
import type { Context } from "gorsee/server"

export async function load(_ctx: Context) {
  return {
    workflows: [
      "gorsee ai ide-sync",
      "gorsee ai pack",
      "gorsee ai mcp",
      "gorsee ai doctor",
    ],
  }
}

export default function OpsPage(props: { data: { workflows: string[] } }) {
  return (
    <main>
      <Head><title>Ops Workflows</title></Head>
      <h1>Ops Workflows</h1>
      <ul>
        {props.data.workflows.map((workflow) => <li>{workflow}</li>)}
      </ul>
    </main>
  )
}
