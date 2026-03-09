export async function load(ctx: any) {
  return {
    user: ctx.locals.session?.userId ?? "guest",
  }
}

export default function DashboardPage(props: any) {
  return <main>dashboard:{props.data.user}</main>
}
