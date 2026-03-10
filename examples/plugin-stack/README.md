# Plugin Stack Example

Canonical example for a mature product-style plugin composition surface.

This example demonstrates the recommended Gorsee path for:

- `gorsee/plugins` as the stable plugin contract surface
- deterministic `createPluginRunner` registration and `dependsOn` ordering
- plugin-ready runtime metadata without falling back to root `gorsee`
- a fullstack app shape that keeps plugin proof visible through a real API route
