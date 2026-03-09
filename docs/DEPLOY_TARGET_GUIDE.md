# Deploy Target Guide

This document defines deploy target guidance for Gorsee as a mature product.

## Supported Product Paths

Current operator-facing deploy paths are:

- Bun / Docker
- Node / Docker
- Fly.io
- Cloudflare
- Netlify
- Vercel

## Target Rules

- always replace `APP_ORIGIN` placeholders
- keep proxy/origin assumptions explicit
- validate generated deploy artifacts before release
- validate generated provider handlers through executable runtime smoke, not only text snapshots
- treat provider adapters as product surfaces, not loose examples
- use explicit runtime profiles for process-based targets instead of editing generated entrypoints by hand

## Per-Target Guidance

- Bun / Docker: use when you want explicit Bun-first process-level control through `gorsee deploy docker --runtime bun`
- Node / Docker: use when the app must ship on a Node process runtime through `gorsee deploy docker --runtime node`
- Fly.io: use when you want an explicit Bun or Node process runtime through `gorsee deploy fly --runtime bun|node`
- Cloudflare: use when edge deployment is required and worker assumptions are explicit
- Netlify: use when generated edge/runtime wiring matches the real deployment model
- Vercel: use when app/server/RPC assumptions are validated against Vercel Node runtime constraints through `dist/server-handler-node.js`
