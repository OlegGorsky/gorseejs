# Release Checklist

Use this checklist before any Gorsee release.

Gorsee releases are product releases. Do not use this checklist with “good enough” standards.

## Stable

1. run `bun run verify:security`
2. run `bun test`
3. run `npm run release:extension`
4. run `npm run release:check`
5. run `npm run release:smoke`
6. run `bun run release:stable:check`
7. run `bun run compiler:promotion:check`
8. run `bun run build:promotion:check`
9. run `bun run backend:switch:evidence:check`
10. run `bun run backend:default-switch:review:check`
11. run `bun run backend:candidate:rollout:check`
12. run `bun run compiler:default:rehearsal:check`
13. run `bun run build:default:rehearsal:check`
14. run `bun run backend:candidate:verify`
15. confirm `docs/API_STABILITY.md`, `docs/SUPPORT_MATRIX.md`, `docs/DEPRECATION_POLICY.md`, ``docs/SECURITY_MODEL.md`, `docs/ADAPTER_SECURITY.md`, `docs/RUNTIME_FAILURES.md`, `docs/RUNTIME_TRIAGE.md`, `docs/AI_WORKFLOWS.md`, `docs/AI_SURFACE_STABILITY.md`, `docs/UPGRADE_PLAYBOOK.md`, `docs/FIRST_PRODUCTION_ROLLOUT.md`, `docs/BENCHMARK_METHODOLOGY.md`, `docs/BENCHMARK_RELEASE_DISCIPLINE.md`, `docs/EVIDENCE_POLICY.md`, `docs/BACKEND_SWITCH_EVIDENCE.md`, `docs/COMPILER_DEFAULT_SWITCH_DOSSIER.md`, `docs/BUILD_DEFAULT_SWITCH_DOSSIER.md`, `docs/BACKEND_DEFAULT_SWITCH_REVIEW.md`, `docs/COMPILER_DEFAULT_SWITCH_REHEARSAL.md`, `docs/BUILD_DEFAULT_SWITCH_REHEARSAL.md`, `docs/BACKEND_CANDIDATE_ROLLOUT_PLAN.md`, `docs/ROADMAP_COMPLETION_POLICY.md`, and `docs/RELEASE_POLICY.md` still match the shipped runtime behavior
16. confirm canonical examples and `docs/EXAMPLES_POLICY.md` still match the shipped product paths
17. confirm the packed tarball ships compiled `dist-pkg/` artifacts, not raw `src/` entrypoints
18. publish only after canary/rc validation is complete for security-sensitive changes

## Canary

1. run `bun run verify:security`
2. run `npm run release:check`
3. run `npm run release:smoke`
4. run `bun run release:canary:check`
5. run `bun run compiler:promotion:check`
6. run `bun run build:promotion:check`
7. run `bun run backend:switch:evidence:check`
8. run `bun run backend:default-switch:review:check`
9. run `bun run backend:candidate:rollout:check`
10. run `bun run compiler:default:rehearsal:check`
11. run `bun run build:default:rehearsal:check`
12. run `bun run backend:candidate:verify`
13. confirm canonical examples still install/check/build as release references
14. confirm the packed tarball still exposes compiled `dist-pkg/` exports and bin paths
15. compute the next canary version with `node scripts/release-version-plan.mjs canary`
16. publish with the `canary` tag

## Release Candidate

1. run `bun run verify:security`
2. run `bun test`
3. run `npm run release:extension`
4. run `npm run release:check`
5. run `npm run release:smoke`
6. run `bun run release:rc:check`
7. run `bun run compiler:promotion:check`
8. run `bun run build:promotion:check`
9. run `bun run backend:switch:evidence:check`
10. run `bun run backend:default-switch:review:check`
11. run `bun run backend:candidate:rollout:check`
12. run `bun run compiler:default:rehearsal:check`
13. run `bun run build:default:rehearsal:check`
14. run `bun run backend:candidate:verify`
15. confirm canonical examples still install/check/build as release references
16. confirm the packed tarball still exposes compiled `dist-pkg/` exports and bin paths
17. compute the next RC version with `node scripts/release-version-plan.mjs rc`
18. validate release artifacts and deploy templates before promoting to stable

## Invariants

- do not publish stable directly from an unvalidated security-sensitive branch
- do not publish any channel with placeholder origins left in generated deploy artifacts
- do not publish if `bun.lock` or runtime dependency pins drift from `package.json`
- treat release failure packs in `.gorsee/agent/` as part of the release triage surface
- do not publish if README or product/security docs materially misdescribe shipped behavior
