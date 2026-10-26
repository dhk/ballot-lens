# Current handoff

Updated: 2026-10-26

The M0 technical slice implements strict TypeScript, Zod/generated JSON Schema contracts, a synthetic pack with source hashes and exact locators, review-history validation, immutable SQLite release imports, bounded local ingestion, five read operations, CLI/JSON conformance, CI and fixtures. Use Node 24: `npm ci`, then `npm run check`. The CLI validates and reads `packs/synthetic/pack.json`; all records and approval events are fictional.

Read `docs/contracts.md` and `docs/decisions/0001-m0-foundation.md` for limits. Six future operations deliberately return `UNAVAILABLE_ANALYSIS`; real packs cannot be served before editorial authorization. No MCP, production UI, source network ingestion, real findings, endorsement math, impact calculations, or public launch is implemented.

Next: finish M0 source reconciliation and human pilot/rubric decisions, then M1. `docs/inventory/sf-2026-11-03.md` records a blocked Elections page, provisional official Ethics discovery, unknown rights, and B/G/H as unapproved pilot candidates. `docs/backlog.md` records owners/dependencies. M0 as a whole remains open. Do not interpret the synthetic technical exit as real editorial or release approval.

PR review revisions preserve usage help, distinguish internal failures, add committed golden response checks for every operation, strengthen SQLite against REPLACE/unrelated databases, test stored-hash/file bounds, and preserve original snapshot bytes. Real evidence-invariance testing remains M2/M3 work. CI runs on PRs and pushes to main, with actions pinned by SHA. Runtime API and aggregate pack-size risks are documented in ADR 0001; M0-01 remains open for maintainer acceptance.
