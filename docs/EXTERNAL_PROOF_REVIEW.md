# External Proof Review

This document defines the review workflow for moving external proof from pending intake to accepted registry.

Machine-readable companions:

- `docs/EXTERNAL_PROOF_PIPELINE.json`
- `docs/EXTERNAL_PROOF_REGISTRY.json`

## Review States

- `pending`: candidate captured but not yet reviewed
- `verified`: source checked and claim mapping is credible
- `accepted`: moved into the accepted registry
- `rejected`: source or claims are not strong enough for canonical proof

## Review Checklist

1. confirm the URL is public and stable enough to cite
2. confirm the source is external to this repository
3. confirm the claimed app shape/runtime target are explicit
4. confirm the validated claims are concrete and non-empty
5. confirm the case does not overstate market proof beyond what the source supports
6. move the entry from `docs/EXTERNAL_PROOF_PIPELINE.json` to `docs/EXTERNAL_PROOF_REGISTRY.json` only after verification

## Product Rule

- pending entries may inform operator follow-up, but not public proof claims
- only accepted registry entries count toward closing external proof backlog items
- rejected entries should be removed from canonical proof files rather than left as ambiguous evidence
