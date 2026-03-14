# Node and npm Adoption

This document defines the canonical Node and npm adoption path for Gorsee as a mature product.

Gorsee remains Bun-first for local development and build execution.
That does not mean Node and npm are second-class for adoption. The supported contract is narrower and explicit:

- Bun is the primary dev/build runtime.
- Node is a validated production runtime target.
- npm and `npx` are validated bootstrap and packed-install paths.
- support claims should not expand beyond these validated paths without new release checks.

## Validated Adoption Paths

### Bootstrap

These bootstrap flows are part of the product contract:

- `bunx gorsee create my-app`
- `npx create-gorsee my-app`
- `npm create gorsee@latest my-app`

### Install

These install paths are part of the release contract:

- workspace/source install
- packed tarball install
- workspace-monorepo install

Those paths are validated through `npm run install:matrix` and `npm run release:smoke`.

### Runtime

These runtime expectations are validated:

- Bun production runtime through `gorsee start`
- Node production runtime through `gorsee start --runtime node`
- direct Node entry execution through `node dist/prod-node.js`
- Bun/Node-compatible server handlers emitted by the build output for adapter runtimes

## Operator Guidance

Use Bun when:

- developing locally
- running canonical build/check/typegen/docs workflows
- following the shortest path through the framework docs

Use Node when:

- the target platform standardizes on Node process runtimes
- Docker or Fly should emit a Node profile
- the deployment contract needs `dist/prod-node.js` or `dist/server-handler-node.js`

Use npm and `npx` when:

- onboarding a new team through familiar package-manager entrypoints
- validating packed release behavior instead of source-workspace behavior
- proving that adoption does not require prior Bun buy-in on day zero

## Explicit Non-Claims

The current product contract does not claim:

- npm-first local development as the primary path
- Node-first local build execution as the primary path
- support parity across every package manager by reputation alone
- broader support claims for `pnpm` or `yarn` without dedicated validation

## Product Rule

Adoption guidance must stay explicit:

- Bun-first for primary development/build ergonomics
- Node/npm validated where release and support docs say they are validated
- no broader support language without new install/runtime evidence
