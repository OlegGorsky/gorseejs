import { island, createSignal } from "gorsee/client"

function CommentFormInner(props: { articleId: number }) {
  const [text, setText] = createSignal("")

  const submit = async (e: Event) => {
    e.preventDefault()
    const body = text().trim()
    if (!body) return

    const form = new FormData()
    form.set("body", body)
    await fetch(`/api/comment?articleId=${props.articleId}`, { method: "POST", body: form })
    setText("")
    location.reload()
  }

  return (
    <form on:submit={submit}>
      <textarea
        placeholder="Write a comment..."
        rows={3}
        value={text()}
        on:input={(e: Event) => setText((e.target as HTMLTextAreaElement).value)}
      />
      <button type="submit">Post Comment</button>
    </form>
  )
}

export default island(CommentFormInner)
