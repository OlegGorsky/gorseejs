import { createMemoryJobQueue, defineJob, type Context } from "gorsee/server"

const jobs = createMemoryJobQueue()

const pingJob = defineJob<{ source: string }>("ping-audit", async (_payload) => {
  return
})

export async function GET(_ctx: Context): Promise<Response> {
  return Response.json({
    service: "gorsee-server-api",
    status: "ok",
  })
}

export async function POST(_ctx: Context): Promise<Response> {
  await jobs.enqueue(pingJob, { source: "manual" })
  return Response.json({ accepted: true }, { status: 202 })
}
