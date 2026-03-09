// Deeply nested page -- 20 levels of nested divs

function Nest({ depth, max }: { depth: number; max: number }): any {
  if (depth >= max) {
    return <span class="leaf">Leaf node at depth {depth}</span>
  }
  return (
    <div class={`level-${depth}`}>
      <Nest depth={depth + 1} max={max} />
    </div>
  )
}

export default function NestedPage() {
  return (
    <main>
      <h1>Deep Nesting Test</h1>
      <Nest depth={0} max={20} />
    </main>
  )
}
