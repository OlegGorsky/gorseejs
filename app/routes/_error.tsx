export default function ErrorPage(props: { error: Error }) {
  return (
    <div class="error-page">
      <h1>Something went wrong</h1>
      <p>{props.error.message}</p>
      <a href="/">Go back home</a>
    </div>
  )
}
