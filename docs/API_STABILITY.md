# API Stability Policy

This document defines Gorsee's public API stability tiers.

The goal is to make framework evolution explicit for humans, coding agents, and downstream tools.

Gorsee is a mature product, so API stability must be governed deliberately rather than inferred informally.

## Stability Tiers

### Stable

Stable APIs are intended for production use and should preserve backward compatibility across minor releases.

Examples:

- `gorsee/client`
- `gorsee/server`
- documented CLI commands intended for user workflows
- machine-readable artifacts emitted by documented CLI commands
- documented runtime and security contracts

Rules:

- breaking changes require a major release
- semantic tightening that can break real applications must go through canary and RC validation
- docs and examples should prefer stable APIs by default

### Compatibility

Compatibility APIs exist to support migration or preserve older usage patterns.

Examples:

- root `gorsee`
- explicitly documented compatibility aliases

Rules:

- new product guidance should not recommend compatibility APIs for greenfield code
- compatibility APIs may be deprecated after a migration path exists
- compatibility layers must not dictate future architecture

### Experimental

Experimental APIs are available for validation but are not yet part of the long-term compatibility promise.

Examples:

- new product surfaces that need feedback under real use
- new AI-facing protocols before versioning is finalized

Rules:

- must be clearly labeled in docs
- should not be silently relied upon by generated scaffolds unless explicitly marked
- may change across minor releases when justified

### Internal

Internal APIs are implementation details and are not supported for external consumption.

Examples:

- non-exported modules
- internal runtime glue
- scripts, helpers, and private implementation details not documented as public surface

Rules:

- internal code may evolve freely to preserve product quality
- if downstream usage becomes common, either promote it deliberately or keep it unsupported

## Current Public Surface Guidance

- `gorsee/client` is stable and preferred for browser-safe code.
- `gorsee/server` is stable and preferred for server runtime code.
- dedicated stable subpaths such as `gorsee/auth`, `gorsee/db`, `gorsee/security`, `gorsee/ai`, `gorsee/forms`, `gorsee/routes`, `gorsee/i18n`, and `gorsee/content` should be preferred when the concern is already clearly scoped.
- compatibility re-exports may remain on `gorsee/client` and `gorsee/server`, but docs, examples, and generators should prefer the dedicated stable subpath when one exists.
- root `gorsee` is compatibility-only.
- `gorsee/compat` is the explicit compatibility entrypoint.
- docs should avoid teaching compatibility-only entrypoints except in migration contexts.

## Release Implications

- stable-surface changes require stronger compatibility review
- compatibility-surface changes require migration reasoning
- experimental-surface changes require explicit labeling
- internal changes still require tests if they affect product contracts

## Product Standard

Public API growth is not a goal by itself.

New APIs should be added only when they strengthen the framework's deterministic, AI-first, reactive-first model.
