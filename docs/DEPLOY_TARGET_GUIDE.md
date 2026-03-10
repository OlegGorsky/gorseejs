# Deploy Target Guide

This document defines deploy target guidance for Gorsee as a mature product.

Machine-readable companion: `docs/DEPLOY_CONTRACT.json`

## Supported Product Paths

Current operator-facing deploy paths are:

- Bun / Docker
- Node / Docker
- Fly.io
- Cloudflare
- Netlify
- Vercel

## Mode Guidance

- `frontend` mode: prefer static-capable targets and prerendered output; avoid process runtime assumptions
- `fullstack` mode: use the canonical Gorsee deploy/runtime path across Bun, Node, or worker-style targets
- `server` mode: use process or service-style targets where API/runtime ownership stays explicit

## Target Rules

- always replace `APP_ORIGIN` placeholders
- keep proxy/origin assumptions explicit
- validate generated deploy artifacts before release
- validate generated provider handlers through executable runtime smoke, not only text snapshots
- treat provider adapters as product surfaces, not loose examples
- use explicit runtime profiles for process-based targets instead of editing generated entrypoints by hand

## Per-Target Guidance

- Frontend mode: prefer Cloudflare or Netlify until dedicated static-only Docker/Fly generators exist
- Bun / Docker: use when you want explicit Bun-first process-level control through `gorsee deploy docker --runtime bun`
- Node / Docker: use when the app must ship on a Node process runtime through `gorsee deploy docker --runtime node`
- Fly.io: use when you want an explicit Bun or Node process runtime through `gorsee deploy fly --runtime bun|node`
- Cloudflare: use when edge deployment is required and worker assumptions are explicit
- Netlify: use when generated edge/runtime wiring matches the real deployment model
- Vercel: use when fullstack or server app/server/RPC assumptions are validated against Vercel Node runtime constraints through `dist/server-handler-node.js`
