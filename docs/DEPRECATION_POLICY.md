# Deprecation Policy

This document defines how Gorsee deprecates public behavior.

Gorsee is a mature product, so deprecation must follow an explicit product workflow rather than ad-hoc code comments or silent drift.

## Goals

- preserve trust in stable APIs
- make migration predictable
- prevent silent architectural drift

## Rules

### Stable APIs

- do not break stable APIs in minor releases
- if removal is necessary, mark the API deprecated first and provide a migration path
- prefer canary and RC exposure before a major release removes stable behavior

### Compatibility APIs

- compatibility layers may be deprecated once the preferred replacement is clear
- docs should move users toward canonical entrypoints before removal

### Experimental APIs

- experimental APIs may change faster, but the docs must say so explicitly
- once an experimental API becomes central to the framework story, it should graduate into a stable contract

## Required Deprecation Artifacts

When deprecating a public API, the repository should include:

- updated docs
- migration guidance
- machine-readable deprecation metadata in `docs/DEPRECATION_SURFACE.json` when the public surface is still exported for compatibility
- upgrade-audit coverage when the deprecated behavior can be detected statically
- release notes entry
- tests that cover the intended replacement path when applicable

## Product Standard

Deprecation is a product workflow, not an informal comment in code.

If downstream users or agents cannot understand the migration path, the deprecation is incomplete.
