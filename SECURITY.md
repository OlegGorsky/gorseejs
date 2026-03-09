# Security Policy

## Supported Versions

Security fixes are applied to the latest stable release line and the current `main` branch.

Older versions are expected to upgrade unless a severe issue justifies a backport.

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability.

Use a private channel instead:

- `security@gorsee.dev`
- fallback: maintainer/repository contact listed in package metadata or release notes

Include:

- affected version(s)
- minimal reproduction
- whether the issue affects `dev`, `prod`, build, adapters, or generated apps
- deployment assumptions if `Host`, `Origin`, proxy headers, cache, or CDN behavior matter

## Disclosure Policy

- valid reports are acknowledged privately
- reproduction comes before triage
- coordinated disclosure is preferred
- fixes should ship with remediation guidance
- security-sensitive fixes should be called out separately in release notes/changelog

## Severity Model

Framework-level issues are high priority when they break invariants in these classes:

- auth bypass
- origin confusion
- cache poisoning
- SSRF
- deserialization abuse
- source exposure
- dev-server abuse
- path traversal / path normalization bypass

## Compatibility Policy

Security fixes may intentionally change semantics when the old behavior was unsafe.

Examples:

- requiring canonical origin in production
- tightening internal header handling
- making cache defaults more private
- making RPC/content-type/origin rules stricter

These are valid security-driven compatibility changes and should ship with migration guidance.

## Maintainer Policy

Security bugs are treated as broken framework invariants, not isolated defects.

Expected workflow:

1. reproduce
2. identify the violated invariant
3. add a regression test for the bug class
4. tighten the framework contract
5. document the change and migration impact
