// Tailwind CSS integration plugin -- build pipeline hook

import { defineBuildPlugin } from "../build/plugin.ts"
import type { GorseePlugin } from "./index.ts"
import { definePlugin } from "./index.ts"

export interface TailwindPluginConfig {
  configPath?: string
  inputCSS?: string
  outputCSS?: string
}

/** Generates tailwind.config.ts content */
export function generateTailwindConfig(options?: {
  content?: string[]
  theme?: Record<string, unknown>
}): string {
  const content = options?.content ?? [
    "./routes/**/*.{tsx,ts}",
    "./components/**/*.{tsx,ts}",
  ]
  const themeStr = options?.theme
    ? JSON.stringify(options.theme, null, 4)
    : "{}"

  return `/** @type {import('tailwindcss').Config} */
export default {
  content: ${JSON.stringify(content, null, 4)},
  theme: {
    extend: ${themeStr},
  },
  plugins: [],
}
`
}

/** Generates base CSS with @tailwind directives */
export function generateTailwindCSS(): string {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;
`
}

/** Creates a Tailwind CSS integration plugin */
export function tailwindPlugin(config: TailwindPluginConfig = {}): GorseePlugin {
  const inputCSS = config.inputCSS ?? "./styles/globals.css"
  const outputCSS = config.outputCSS ?? "./.gorsee/client/tailwind.css"

  return definePlugin({
    name: "gorsee-tailwind",
    capabilities: ["styling"],

    async setup() {
      // Generate tailwind.config.ts if it doesn't exist
      const configPath = config.configPath ?? "./tailwind.config.ts"
      const file = Bun.file(configPath)
      if (!(await file.exists())) {
        await Bun.write(configPath, generateTailwindConfig())
      }
    },

    buildPlugins() {
      return [
        defineBuildPlugin({
          name: "gorsee-tailwind-transform",
          bun: {
            name: "gorsee-tailwind-transform",
            setup(build) {
              build.onLoad({ filter: /\.css$/ }, async (args) => {
                const source = await Bun.file(args.path).text()

                // If file contains @tailwind directives, process it
                if (source.includes("@tailwind")) {
                  try {
                    const proc = Bun.spawn(
                      ["bunx", "tailwindcss", "-i", args.path, "-o", outputCSS, "--minify"],
                      { stdin: "inherit", stdout: "pipe", stderr: "pipe" },
                    )
                    await proc.exited
                    const processed = await Bun.file(outputCSS).text()
                    return { contents: processed, loader: "css" }
                  } catch {
                    // Fallback: return raw CSS if tailwindcss CLI not available
                    return { contents: source, loader: "css" }
                  }
                }

                return undefined
              })
            },
          },
        }),
      ]
    },
  })
}
