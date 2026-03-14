# Release Checklist

Use this checklist before any Gorsee release.

Gorsee releases are product releases. Do not use this checklist with “good enough” standards.

Machine-readable companion: `docs/RELEASE_CONTRACT.json`

## Stable

1. run `bun run verify:security`
2. run `bun run api:policy`
3. run `bun run adoption:policy`
4. run `bun run critical:surface`
5. run `bun test`
6. run `npm run release:extension`
7. run `npm run release:check`
8. run `npm run release:smoke`
9. run `bun run release:stable:check`
10. run `bun run compiler:promotion:check`
11. run `bun run build:promotion:check`
12. run `bun run backend:switch:evidence:check`
13. run `bun run backend:default-switch:review:check`
14. run `bun run backend:candidate:rollout:check`
15. run `bun run compiler:default:rehearsal:check`
16. run `bun run build:default:rehearsal:check`
17. run `bun run backend:candidate:verify`
18. confirm `docs/API_STABILITY.md`, `docs/CLI_CONTRACT.json`, `docs/APPLICATION_MODES.md`, `docs/SUPPORT_MATRIX.md`, `docs/DEPRECATION_POLICY.md`, ``docs/SECURITY_MODEL.md`, `docs/ADAPTER_SECURITY.md`, `docs/RUNTIME_FAILURES.md`, `docs/RUNTIME_TRIAGE.md`, `docs/AI_WORKFLOWS.md`, `docs/AI_SURFACE_STABILITY.md`, `docs/UPGRADE_PLAYBOOK.md`, `docs/FIRST_PRODUCTION_ROLLOUT.md`, `docs/RELEASE_CONTRACT.json`, `docs/BENCHMARK_METHODOLOGY.md`, `docs/BENCHMARK_RELEASE_DISCIPLINE.md`, `docs/EVIDENCE_POLICY.md`, `docs/BACKEND_SWITCH_EVIDENCE.md`, `docs/COMPILER_DEFAULT_SWITCH_DOSSIER.md`, `docs/BUILD_DEFAULT_SWITCH_DOSSIER.md`, `docs/BACKEND_DEFAULT_SWITCH_REVIEW.md`, `docs/COMPILER_DEFAULT_SWITCH_REHEARSAL.md`, `docs/BUILD_DEFAULT_SWITCH_REHEARSAL.md`, `docs/BACKEND_CANDIDATE_ROLLOUT_PLAN.md`, `docs/ROADMAP_COMPLETION_POLICY.md`, `docs/TOP_TIER_EXIT_GATE.md`, and `docs/RELEASE_POLICY.md` still match the shipped runtime behavior
19. confirm canonical examples and `docs/EXAMPLES_POLICY.md` still match the shipped product paths
20. confirm the packed tarball ships compiled `dist-pkg/` artifacts, not raw `src/` entrypoints
21. publish only after canary/rc validation is complete for security-sensitive changes

## Canary

1. run `bun run verify:security`
2. run `bun run api:policy`
3. run `bun run adoption:policy`
4. run `bun run critical:surface`
5. run `npm run release:check`
6. run `npm run release:smoke`
7. run `bun run release:canary:check`
8. run `bun run compiler:promotion:check`
9. run `bun run build:promotion:check`
10. run `bun run backend:switch:evidence:check`
11. run `bun run backend:default-switch:review:check`
12. run `bun run backend:candidate:rollout:check`
13. run `bun run compiler:default:rehearsal:check`
14. run `bun run build:default:rehearsal:check`
15. run `bun run backend:candidate:verify`
16. confirm canonical examples still install/check/build as release references
17. confirm the packed tarball still exposes compiled `dist-pkg/` exports and bin paths
18. compute the next canary version with `node scripts/release-version-plan.mjs canary`
19. publish with the `canary` tag

## Release Candidate

1. run `bun run verify:security`
2. run `bun run api:policy`
3. run `bun run adoption:policy`
4. run `bun run critical:surface`
5. run `bun test`
6. run `npm run release:extension`
7. run `npm run release:check`
8. run `npm run release:smoke`
9. run `bun run release:rc:check`
10. run `bun run compiler:promotion:check`
11. run `bun run build:promotion:check`
12. run `bun run backend:switch:evidence:check`
13. run `bun run backend:default-switch:review:check`
14. run `bun run backend:candidate:rollout:check`
15. run `bun run compiler:default:rehearsal:check`
16. run `bun run build:default:rehearsal:check`
17. run `bun run backend:candidate:verify`
18. confirm canonical examples still install/check/build as release references
19. confirm the packed tarball still exposes compiled `dist-pkg/` exports and bin paths
20. compute the next RC version with `node scripts/release-version-plan.mjs rc`
21. validate release artifacts and deploy templates before promoting to stable

## Invariants

- do not publish stable directly from an unvalidated security-sensitive branch
- do not publish any channel with placeholder origins left in generated deploy artifacts
- do not publish if `bun.lock`, committed example lockfiles, or runtime dependency pins drift from `package.json`
- treat release failure packs in `.gorsee/agent/` as part of the release triage surface
- do not publish if README or product/security docs materially misdescribe shipped behavior
- do not publish if release diagnostics or AI incident artifacts disagree with the intended `app.mode` or `runtime.topology`
