/** @deprecated Import shared project context from "../runtime/project" in new code. */
export {
  createProjectContext as createCommandContext,
  resolveProjectPaths,
} from "../runtime/project.ts"

/** @deprecated Import shared runtime types from "../runtime/project" in new code. */
export type {
  RuntimeOptions as CommandRuntimeOptions,
  ProjectContext as CommandContext,
  ProjectPaths,
} from "../runtime/project.ts"
