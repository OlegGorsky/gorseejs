import { Head, createSignal } from "gorsee/client"
import { describeWorkspace } from "@example/shared"

export default function WorkspaceHome() {
  const [count, setCount] = createSignal(0)

  return (
    <main>
      <Head><title>Workspace Example</title></Head>
      <h1>{describeWorkspace()}</h1>
      <button on:click={() => setCount((value) => value + 1)}>Count: {count}</button>
    </main>
  )
}
