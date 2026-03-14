# External Proof Intake

This document defines how external migration stories and external reference apps enter the Gorsee proof system.

Machine-readable companions:

- `docs/EXTERNAL_PROOF_CLAIMS.json` for normalized validated claim ids
- `docs/EXTERNAL_PROOF_OUTREACH.json` for sourced leads before they become pending candidates
- `docs/EXTERNAL_PROOF_PIPELINE.json` for pending candidates
- `docs/EXTERNAL_PROOF_REGISTRY.json` for accepted external proof

Operator review guide:

- `docs/EXTERNAL_PROOF_EXECUTION.md`
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
- concrete claims validated by the migration, expressed with ids from `docs/EXTERNAL_PROOF_CLAIMS.json`

Template:

- `docs/templates/EXTERNAL_MIGRATION_CASE_STUDY.md`

### External Reference Deployment

Use when a public downstream repository, production deployment, or public implementation validates Gorsee in real use outside this repository.

Minimum evidence:

- public repo or deployment URL
- app shape and runtime target
- validated framework claims, expressed with ids from `docs/EXTERNAL_PROOF_CLAIMS.json`
- brief operator note about why the reference matters

Template:

- `docs/templates/EXTERNAL_REFERENCE_PROFILE.md`

## Intake Rules

- do not add placeholder or private-only references to the registry
- do not treat conference slides, roadmap notes, or unpublished demos as external proof
- keep pre-qualification leads in `docs/EXTERNAL_PROOF_OUTREACH.json` rather than promoting them directly into the pending pipeline
- do not mark competition gaps closed until accepted public entries exist in `docs/EXTERNAL_PROOF_REGISTRY.json`
- keep `docs/TOP_TIER_COMPETITION_PLAN.md`, `docs/COMPETITION_CLOSURE_PLAN.md`, and `docs/PRODUCT_SURFACE_AUDIT.md` aligned when the registry changes
- pending candidates may live in `docs/EXTERNAL_PROOF_PIPELINE.json`, but they must not be cited as accepted proof

## Workflow

1. source and qualify the lead using `docs/EXTERNAL_PROOF_EXECUTION.md` and `docs/EXTERNAL_PROOF_OUTREACH.json`
2. use `npm run external-proof:scaffold -- --type migration|reference --id <candidate-id>` when you need a local draft bundle
   The scaffold should be treated as an intake aid: it preloads claim ids plus repo-local proof hints so the operator can compare the external source against the closest canonical Gorsee app shapes before validating claims.
3. collect the public source URL and validate that it is stable enough to cite
4. draft the entry using the appropriate template
5. if review is still pending, add the candidate to `docs/EXTERNAL_PROOF_PIPELINE.json`
6. once validated, move the entry into `docs/EXTERNAL_PROOF_REGISTRY.json`
7. update competition/adoption docs if the accepted entry changes market-facing claims
8. only then treat the proof as part of the canonical external evidence surface
