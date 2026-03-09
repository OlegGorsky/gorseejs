# Build Default Switch Rehearsal

This document defines the regression-verification path for exercising the canonical `rolldown` build default through the same operator-visible flow used during the switch.

## Rehearsal Command

- `bun run build:default:rehearsal`

## Required Coverage

- build parity remains green
- canonical build workflow remains green
- build dossier check remains green
- backend default switch review remains green

## Current Status

- rehearsal status: green
- release decision impact: protects the canonical build default
- default switch impact: none unless regression forces a review

## Product Rule

Rehearsal is a regression guard for the canonical build default. It is not a substitute for backend review.
