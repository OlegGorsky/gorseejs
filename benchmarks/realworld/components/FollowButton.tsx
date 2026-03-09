import { island, createSignal } from "gorsee/client"

function FollowButtonInner(props: { userId: number; username: string; following: boolean }) {
  const [following, setFollowing] = createSignal(props.following)

  const toggle = async () => {
    const form = new FormData()
    form.set("followedId", String(props.userId))
    const res = await fetch("/api/follow", { method: "POST", body: form })
    const data = await res.json()
    setFollowing(data.following)
  }

  return (
    <button class={following() ? "btn-follow active" : "btn-follow"} on:click={toggle}>
      {following() ? "Unfollow" : "Follow"} {props.username}
    </button>
  )
}

export default island(FollowButtonInner)
