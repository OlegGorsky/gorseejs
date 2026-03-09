# Secure SaaS Example

Canonical example for a mature product-style authenticated SaaS app.

This example demonstrates the recommended Gorsee path for:

- authenticated dashboards
- protected route groups
- private document cache
- explicit RPC auth boundary

Imports:

- `gorsee/client` for route UI
- `gorsee/server` for `load`, `action`, middleware, cache, and RPC policy
- `gorsee/auth` for auth and session contracts
