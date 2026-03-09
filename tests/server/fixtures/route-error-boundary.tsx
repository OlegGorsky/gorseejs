export default function RouteErrorBoundary(props: { error: Error; params: { slug: string } }) {
  return (
    <main data-kind="error-boundary">
      <h1>{props.error.message}</h1>
      <p>{props.params.slug}</p>
    </main>
  )
}
