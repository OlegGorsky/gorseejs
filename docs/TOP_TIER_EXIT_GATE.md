# Top-Tier Exit Gate

This document defines the canonical exit gate for declaring Gorsee's baseline top-tier maturity complete.

The purpose of this gate is to stop indefinite baseline hardening.

Once this gate is satisfied, Gorsee moves from "proving it is a mature framework" to "operating as a mature framework".

## Exit Decision

Top-tier baseline maturity is complete only when all of the following are true:

1. every stage in `docs/TOP_TIER_ROADMAP.md` is marked closed or baseline closed
2. the release, proof, API, dependency, deploy, runtime-security, diagnostics, CI, and coverage policy surfaces are all part of the enforced product contract
3. canonical examples, benchmark proof surfaces, and rollout/adoption docs still match the shipped product
4. support claims are limited to validated targets in `docs/SUPPORT_MATRIX.md`
5. there is no remaining roadmap item that is still required to justify current public maturity claims

If any of these become false, the project has reopened a maturity gap and must treat it as product debt, not optional cleanup.

## What Changes After Exit

After the exit gate is met, new work does not automatically count as missing maturity.

New work must be classified as one of:

- maintenance of an existing contract
- regression repair backed by tests or evidence
- deliberate platform evolution
- explicit surface expansion with docs, tests, and release impact accounted for

The default assumption after exit is:

- the baseline is complete
- the burden of proof is on reopening it
- roadmap churn is not allowed without a concrete broken contract or a deliberate strategic expansion

## Reopen Rule

Baseline maturity may be reopened only if at least one of the following is true:

- a current public claim in README or docs is not backed by code, tests, or policy enforcement
- a supported surface lacks the validation required by `docs/SUPPORT_MATRIX.md`
- a release can pass while a documented security, runtime, deploy, or API contract is materially broken
- a canonical proof surface no longer demonstrates the product behavior it is claimed to prove

When reopening maturity, the fix must update:

- the failing contract or policy gate
- the affected docs
- the roadmap wording if the gap is strategic rather than local

## Not A Reopen Trigger

These do not reopen baseline maturity by default:

- ideas for broader ecosystem reach
- optional ergonomics improvements
- speculative abstractions
- alternate APIs with overlapping purpose
- feature parity requests with other frameworks unless they map to Gorsee's stated product identity

These belong to product evolution, not unfinished baseline work.

## Operator Rule

Before starting another "final hardening" cycle, check:

1. is a current contract actually broken?
2. is a support claim currently unjustified?
3. is release governance currently insufficient for a shipped promise?

If the answer is no, do not treat the work as missing maturity. Treat it as maintenance or product expansion.

## Product Standard

Gorsee is allowed to become boring in the best possible sense: explicit contracts, repeatable release discipline, narrow public surfaces, and measured product evolution.

That is the intended state after top-tier baseline closure.
