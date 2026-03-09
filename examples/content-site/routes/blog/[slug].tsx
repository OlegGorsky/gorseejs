export async function load(ctx: any) {
  return {
    slug: ctx.params.slug,
    title: "Public Article",
  }
}

export default function BlogPage(props: any) {
  return <article>article:{props.data.slug}:{props.data.title}</article>
}
