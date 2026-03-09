export type LogLevel = "off" | "error" | "info" | "verbose" | "debug"

import { emitAIEvent } from "../ai/index.ts"

const LEVELS: Record<LogLevel, number> = {
  off: 0,
  error: 1,
  info: 2,
  verbose: 3,
  debug: 4,
}

let currentLevel: LogLevel = "info"

export function setLogLevel(level: LogLevel): void {
  currentLevel = level
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] <= LEVELS[currentLevel]
}

function formatEntry(level: string, message: string, data?: Record<string, unknown>): string {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  }
  return JSON.stringify(entry)
}

function mirrorToAI(level: Exclude<LogLevel, "off">, message: string, data?: Record<string, unknown>): void {
  void emitAIEvent({
    kind: "log.entry",
    severity: level === "verbose" ? "info" : level,
    source: "log",
    message,
    data,
  })
}

export const log = {
  error(message: string, data?: Record<string, unknown>): void {
    if (shouldLog("error")) console.error(formatEntry("error", message, data))
    mirrorToAI("error", message, data)
  },
  info(message: string, data?: Record<string, unknown>): void {
    if (shouldLog("info")) console.log(formatEntry("info", message, data))
    mirrorToAI("info", message, data)
  },
  verbose(message: string, data?: Record<string, unknown>): void {
    if (shouldLog("verbose")) console.log(formatEntry("verbose", message, data))
    mirrorToAI("verbose", message, data)
  },
  debug(message: string, data?: Record<string, unknown>): void {
    if (shouldLog("debug")) console.log(formatEntry("debug", message, data))
    mirrorToAI("debug", message, data)
  },
}
