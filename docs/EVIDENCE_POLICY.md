# Evidence Policy

This document defines how Gorsee maintains benchmark and release evidence for public claims as a mature product.

## Evidence Sources

Public claims should continue to rely on:

- benchmark docs and packages
- release smoke and install matrix
- provider smoke and browser smoke
- confidence suites
- support/release/product policies
- backend switch evidence for compiler/build default changes
- backend default switch review packet for final operator go/no-go decisions
- default-switch rehearsal evidence before any canonical backend promotion
- candidate rollout plan before any stable backend adoption claim

## Rules

- do not separate performance claims from benchmark context
- do not separate support claims from validated targets
- do not separate release claims from release-train checks
- do not change canonical compiler/build defaults without explicit backend switch evidence
- do not cite “framework maturity” without showing the policies and proof surfaces that enforce it

## Product Rule

Evidence must stay current. Claims that outlive their proof surface are product defects.
