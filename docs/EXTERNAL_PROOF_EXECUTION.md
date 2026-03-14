# External Proof Execution

This document is the operator playbook for sourcing, qualifying, and publishing the first accepted external proof entries.

Machine-readable companion:

- `docs/EXTERNAL_PROOF_CLAIMS.json`
- `docs/EXTERNAL_PROOF_OUTREACH.json`

Canonical intake and registry surfaces:

- `docs/EXTERNAL_PROOF_INTAKE.md`
- `docs/EXTERNAL_PROOF_PIPELINE.json`
- `docs/EXTERNAL_PROOF_REVIEW.md`
- `docs/EXTERNAL_PROOF_REGISTRY.json`

## Objective

Close the remaining `external-proof` competition gap without weakening the evidence bar.

That means:

- one public migration case study accepted into the registry
- two public external references accepted into the registry
- explicit validated claims mapped to each accepted entry

## Source Channels

Use only channels that can plausibly produce public, sourceable artifacts:

- public downstream repositories using `gorsee` or `create-gorsee`
- public deployments or demo domains clearly operated outside this repository
- public migration posts, engineering notes, or release posts from downstream teams
- public issue threads or discussions only when they link to a stable public implementation or write-up

Do not count:

- private customer notes
- unpublished screenshots
- direct messages
- conference conversations without a public follow-up artifact

## Qualification Bar

Before a candidate enters the pending pipeline, confirm:

1. the source is public and stable enough to cite
2. the implementation is external to this repository
3. the app shape or migration shape is explicit
4. the validated framework claims are concrete and non-empty
5. the candidate can survive a skeptical public reading without operator backstory

## Execution Sequence

1. source candidate leads through the channels listed in `docs/EXTERNAL_PROOF_OUTREACH.json`
2. optionally scaffold a local draft with `npm run external-proof:scaffold -- --type migration|reference --id <candidate-id>`
3. capture the lead in the outreach queue with current status and next action
4. use the scaffolded draft in `.gorsee/external-proof/drafts/` to collect factual source details
5. if public evidence already exists, draft the candidate using the canonical template
6. add the drafted candidate to `docs/EXTERNAL_PROOF_PIPELINE.json`
7. review the candidate against `docs/EXTERNAL_PROOF_REVIEW.md`
8. move only verified entries into `docs/EXTERNAL_PROOF_REGISTRY.json`
9. update competition docs only after accepted entries exist

## Publication Package

Each accepted proof entry should be accompanied by a public-facing package that is easy to reuse:

- canonical registry entry
- short operator summary for release or changelog references
- validated claim mapping using ids from `docs/EXTERNAL_PROOF_CLAIMS.json` to avoid overstating support or market reach

## Operator Rule

- do not create fake pending entries just to make the pipeline look active
- do not add speculative company names or inferred production users
- do not close `external-proof` until the accepted registry actually contains the required public entries
- keep the outreach queue factual and non-marketing
