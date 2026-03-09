# Compiler Default Switch Rehearsal

This document defines the regression-verification path for exercising the canonical `oxc` compiler default through the same operator-visible flow used during the switch.

## Rehearsal Command

- `bun run compiler:default:rehearsal`

## Required Coverage

- compiler parity remains green
- canonical compiler workflow remains green
- compiler dossier check remains green
- backend default switch review remains green

## Current Status

- rehearsal status: green
- release decision impact: protects the canonical compiler default
- default switch impact: none unless regression forces a review

## Product Rule

Rehearsal is a regression guard for the canonical compiler default. It is not a substitute for backend review.
