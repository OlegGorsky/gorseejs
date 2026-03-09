#!/usr/bin/env node

import { resolve } from "node:path"
import { emitReleaseEvent, parseKeyValueArgs } from "./ai-release-utils.mjs"

const repoRoot = resolve(import.meta.dirname, "..")
const [kind = "release.event", severity = "info", code = "", ...rest] = process.argv.slice(2)
await emitReleaseEvent(repoRoot, kind, severity, code, parseKeyValueArgs(rest))
