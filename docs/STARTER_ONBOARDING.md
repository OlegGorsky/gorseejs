# Starter Onboarding

This document defines the starter onboarding path for Gorsee as a mature product.

## Choose an App Class

Canonical bootstrap entry paths:

- Bun-first: `bunx gorsee create my-app`
- Node/npm-first: `npx create-gorsee my-app`
- npm create alias: `npm create gorsee@latest my-app`

Before building features, choose the closest blessed path:

- Secure SaaS App: `bunx gorsee create my-app --template secure-saas`
- Content / Marketing Site: `bunx gorsee create my-app --template content-site`
- Agent-Aware Internal Tool: `bunx gorsee create my-app --template agent-aware-ops`
- Workspace / Monorepo App: `bunx gorsee create my-app --template workspace-monorepo`

Use `docs/CANONICAL_RECIPES.md` and `examples/README.md` before inventing a fifth shape.

`bunx gorsee create my-app`, `npx create-gorsee my-app`, and `npm create gorsee@latest my-app` without a template use the minimal `basic` starter.

## First Week Checklist

1. run `bun install`
2. commit the generated `bun.lock`
3. run `bun run dev`
4. run `bun run check`
5. set explicit `security.origin`
6. choose your auth/cache/data path
7. decide whether `ai.enabled` is part of your workflow
8. pick a deploy target and replace placeholder origins before shipping

## Product Rule

Starter projects are not toy repos. They inherit the same mature product standard as the framework itself.
