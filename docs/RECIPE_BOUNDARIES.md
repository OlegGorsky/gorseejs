# Recipe Boundaries

This document defines when not to use a given canonical recipe or example for Gorsee as a mature product.

## Do Not Use Secure SaaS

when the app is mostly public content and you do not want personalized cache/auth complexity.

## Do Not Use Content Site

when the app has meaningful per-user state, dashboards, or operator-only workflows.

## Do Not Use Agent-Aware Internal Tool

when AI observability is not part of the product workflow and a simpler public or SaaS path is enough.

## Do Not Use Workspace / Monorepo

when a single app package is sufficient and shared-package complexity would add friction without clear reuse.

## Product Rule

Recipes are there to reduce guesswork. Do not stretch one recipe until it becomes a vague “covers everything” path.
