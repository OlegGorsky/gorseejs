# Team Failures

This document defines common adoption failures for new Gorsee teams as a mature product.

## Common Team-Level Failures

- skipping app-class selection and inventing a custom baseline too early
- leaving root `gorsee` imports in new code
- widening cache policy before proving a route is truly public
- treating RPC protection as implicit
- shipping deploy configs with placeholder origins
- enabling monorepo complexity before a single app path is stable

## Correction Path

When a team hits repeated friction:

1. map the app to a canonical recipe
2. reread the migration/upgrade/deploy docs
3. remove non-canonical patterns
4. convert the missing guidance into repo-level docs or policy
