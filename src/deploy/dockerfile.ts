// Generate Dockerfile for production deployment

import type { ProcessDeployRuntime } from "./runtime.ts"

export function generateDockerfile(runtime: ProcessDeployRuntime = "bun"): string {
  const runtimeImage = runtime === "node" ? "node:20-bookworm-slim" : "oven/bun:1-slim"
  const runtimeCommand = runtime === "node"
    ? 'CMD ["node", "dist/prod-node.js"]'
    : 'CMD ["bun", "run", "start"]'

  return `# Gorsee.js Production Dockerfile
# Runtime profile: ${runtime}
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM ${runtimeImage}
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/.env* ./

ENV NODE_ENV=production
ENV PORT=3000
ENV APP_ORIGIN=REPLACE_WITH_APP_ORIGIN
EXPOSE 3000

${runtimeCommand}
`
}

export function generateDockerignore(): string {
  return `node_modules
.gorsee
.git
*.md
*.sqlite
*.db
.env.local
`
}
