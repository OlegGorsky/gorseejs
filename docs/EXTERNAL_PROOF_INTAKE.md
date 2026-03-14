# External Proof Intake

This document defines how external migration stories and external reference apps enter the Gorsee proof system.

Machine-readable companions:

- `docs/EXTERNAL_PROOF_PIPELINE.json` for pending candidates
- `docs/EXTERNAL_PROOF_REGISTRY.json` for accepted external proof

Operator review guide:

- `docs/EXTERNAL_PROOF_REVIEW.md`

Gorsee is a mature product.

That means external proof should enter the repository through a deterministic intake path rather than through scattered anecdotes in issues, chats, or release notes.

## Accepted Entry Types

### Public Migration Case Study

Use when a team publishes a migration story from another stack into Gorsee.

Minimum evidence:

- public URL for the case study
- prior stack identified explicitly
- resulting Gorsee app shape identified explicitly
- concrete claims validated by the migration

Template:

- `docs/templates/EXTERNAL_MIGRATION_CASE_STUDY.md`

### External Reference Deployment

Use when a public downstream repository, production deployment, or public implementation validates Gorsee in real use outside this repository.

Minimum evidence:

- public repo or deployment URL
- app shape and runtime target
- validated framework claims
- brief operator note about why the reference matters

Template:

- `docs/templates/EXTERNAL_REFERENCE_PROFILE.md`

## Intake Rules

- do not add placeholder or private-only references to the registry
- do not treat conference slides, roadmap notes, or unpublished demos as external proof
- do not mark competition gaps closed until accepted public entries exist in `docs/EXTERNAL_PROOF_REGISTRY.json`
- keep `docs/TOP_TIER_COMPETITION_PLAN.md`, `docs/COMPETITION_CLOSURE_PLAN.md`, and `docs/PRODUCT_SURFACE_AUDIT.md` aligned when the registry changes
- pending candidates may live in `docs/EXTERNAL_PROOF_PIPELINE.json`, but they must not be cited as accepted proof

## Workflow

1. collect the public source URL and validate that it is stable enough to cite
2. draft the entry using the appropriate template
3. if review is still pending, add the candidate to `docs/EXTERNAL_PROOF_PIPELINE.json`
4. once validated, move the entry into `docs/EXTERNAL_PROOF_REGISTRY.json`
5. update competition/adoption docs if the accepted entry changes market-facing claims
6. only then treat the proof as part of the canonical external evidence surface
