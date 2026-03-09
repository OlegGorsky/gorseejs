import { island, createSignal } from "gorsee/client"

function FavButtonInner(props: { articleId: number; count: number; favorited: boolean }) {
  const [count, setCount] = createSignal(props.count)
  const [fav, setFav] = createSignal(props.favorited)

  const toggle = async () => {
    const form = new FormData()
    form.set("articleId", String(props.articleId))
    const res = await fetch("/api/favorite", { method: "POST", body: form })
    const data = await res.json()
    setCount(data.count)
    setFav(data.favorited)
  }

  return (
    <button class={fav() ? "btn-fav active" : "btn-fav"} on:click={toggle}>
      {fav() ? "Unfavorite" : "Favorite"} ({count()})
    </button>
  )
}

export default island(FavButtonInner)
