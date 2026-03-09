// Gorsee.js — Deploy adapters barrel export

export {
  generateDockerfile,
  generateDockerignore,
} from "./dockerfile.ts"

export {
  generateVercelConfig,
  generateVercelServerlessEntry,
  generateVercelBuildOutput,
  type VercelConfig,
  type VercelOutputConfig,
} from "./vercel.ts"

export {
  generateFlyConfig,
  generateFlyDockerfile,
} from "./fly.ts"

export {
  generateWranglerConfig,
  generateCloudflareEntry,
  generateCloudflareStaticAssets,
  type CloudflareRoutesConfig,
} from "./cloudflare.ts"

export {
  generateNetlifyConfig,
  generateNetlifyFunction,
} from "./netlify.ts"

export {
  validateDeployArtifactConformance,
  assertDeployArtifactConformance,
  type DeployArtifactConformanceInput,
  type DeployArtifactConformanceResult,
} from "./conformance.ts"
