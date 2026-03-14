# Secure SaaS Example

Canonical example for a mature product-style authenticated SaaS app.

This example demonstrates the recommended Gorsee path for:

- authenticated dashboards
- protected route groups
- private document cache
- explicit RPC auth boundary
- typed route navigation
- validated form actions for plan and billing settings
- small reactive islands inside a mostly server-rendered app shell

Imports:

- `gorsee/client` for route UI
- `gorsee/server` for `load`, `action`, middleware, cache, and RPC policy
- `gorsee/auth` for auth and session contracts
- `gorsee/forms` for server-validated mutations with progressive enhancement
- `gorsee/routes` for typed route definitions
