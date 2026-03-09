import { join } from "node:path"

export interface ProjectPathOverrides extends Partial<ProjectPaths> {}

export interface RuntimeOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  pathOverrides?: ProjectPathOverrides
}

export interface ProjectPaths {
  cwd: string
  routesDir: string
  publicDir: string
  distDir: string
  clientDir: string
  serverDir: string
  gorseeDir: string
  sharedDir: string
  middlewareDir: string
  migrationsDir: string
  docsDir: string
  dataFile: string
  appConfigFile: string
}

export interface ProjectContext {
  cwd: string
  env: NodeJS.ProcessEnv
  paths: ProjectPaths
}

export interface RuntimeEnvConfig {
  port: number
  logLevel: "info" | "debug"
  rateLimit: number
  rateWindow: string
  isProduction: boolean
}

export function resolveProjectPaths(cwd: string, overrides: ProjectPathOverrides = {}): ProjectPaths {
  const gorseeDir = join(cwd, ".gorsee")
  const distDir = join(cwd, "dist")
  const defaults: ProjectPaths = {
    cwd,
    routesDir: join(cwd, "routes"),
    publicDir: join(cwd, "public"),
    distDir,
    clientDir: join(distDir, "client"),
    serverDir: join(distDir, "server"),
    gorseeDir,
    sharedDir: join(cwd, "shared"),
    middlewareDir: join(cwd, "middleware"),
    migrationsDir: join(cwd, "migrations"),
    docsDir: join(cwd, "docs"),
    dataFile: join(cwd, "data.sqlite"),
    appConfigFile: join(cwd, "app.config.ts"),
  }
  return { ...defaults, ...overrides, cwd }
}

export function createProjectContext(options: RuntimeOptions = {}): ProjectContext {
  const cwd = options.cwd ?? process.cwd()
  return {
    cwd,
    env: options.env ?? process.env,
    paths: resolveProjectPaths(cwd, options.pathOverrides),
  }
}

export function resolveRuntimeEnv(env: NodeJS.ProcessEnv): RuntimeEnvConfig {
  return {
    port: Number(env.PORT || "3000"),
    logLevel: env.LOG_LEVEL === "debug" ? "debug" : "info",
    rateLimit: Number(env.RATE_LIMIT) || 1000,
    rateWindow: env.RATE_WINDOW || "1m",
    isProduction: env.NODE_ENV === "production",
  }
}
