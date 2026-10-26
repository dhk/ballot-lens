# Ballot Lens

Ballot Lens is a planned, interface-independent tool for understanding ballot measures through three separate layers:

- Reviewed evidence with traceable sources and explicit uncertainty.
- Organizational endorsements weighted only by organizations the user selects.
- Provision-linked personal applicability and impact using optional circumstances.

These layers never combine into a vote recommendation. Changing preferences or circumstances must never change evidence.

The initial scope is San Francisco local measures, followed by separate California statewide proposition packs. November 2026 is a pilot corpus, not a launch commitment.

## Project status

The M0 technical foundation is implemented: strict TypeScript, versioned schemas, an offline synthetic pack, citation/review validation, immutable local release storage, a CLI, and conformance tests. There is no real ballot corpus or public product yet. Source reconciliation and human pilot/rubric decisions remain open; see the [backlog](docs/backlog.md). The v0.1 specifications describe later work as well as implemented foundations.

## Start here

- [Product and engineering requirements](docs/requirements.md)
- [Implementation roadmap](docs/roadmap.md)
- [Document provenance](docs/README.md)
- [Contributing](CONTRIBUTING.md)
- [Agent instructions](AGENTS.md)

## Architecture direction

The proposed baseline is strict TypeScript, schema-validated JSON, SQLite local storage, and content-addressed source snapshots. Dependency direction is clients → adapters → application operations → domain; infrastructure implements storage and source ports.

The core must work offline against validated, immutable release packs without a UI, MCP server, network, or model provider. MCP is a read-only adapter; the consumer interface remains undecided. Planned components are `packages/{domain,contracts,ingest,storage,evaluation}`, `apps/cli`, `adapters`, and `packs`.

## Run it

Requires Node 24 and npm. Install dependencies once (network required):

```bash
npm ci
npm run check
npm run cli -- validate packs/synthetic/pack.json
npm run cli -- request packs/synthetic/pack.json packs/synthetic/request.json
```

After installation, build and tests run offline without a UI, MCP server, network, or model provider. `npm run check` runs formatting, strict type checks, the build, fixture/conformance tests, and generated-schema drift checks. The CLI returns JSON and exits nonzero on failure.

To import an immutable synthetic release into SQLite:

```bash
npm run cli -- import packs/synthetic/pack.json /tmp/ballot-lens.sqlite
```

The pack is fictional and clearly labeled. Real packs cannot be served until editorial authorization exists. Endorsement, impact, and worksheet operations currently return `UNAVAILABLE_ANALYSIS`; no calculations or recommendations are fabricated.

## Implementation map

| Directory                   | Responsibility                                                           |
| --------------------------- | ------------------------------------------------------------------------ |
| `packages/contracts`        | Versioned schemas/types and generated JSON Schema                        |
| `packages/domain`           | Pack references, citations, review histories, composition validation     |
| `packages/application`      | Transport-neutral operations and repository port                         |
| `packages/storage`          | Immutable SQLite releases, isolated memory repository, hash verification |
| `packages/ingest`           | Bounded local pack loading; network ingestion is later work              |
| `packages/evaluation`       | Adapter conformance harness                                              |
| `apps/cli`, `adapters/json` | Local CLI and a second non-MCP adapter                                   |
| `packs/synthetic`           | Fictional pack, source originals and request fixtures                    |

Read [contract behavior](docs/contracts.md), [architecture decision](docs/decisions/0001-m0-foundation.md), and [source discovery/gaps](docs/inventory/sf-2026-11-03.md) before extending the implementation. MCP transport, final interface, editorial policy, and real pilot selection remain undecided.

## Next milestone

Finish the official source inventory and human pilot/rubric decisions, then begin M1's reviewed SF evidence slice. M2/M3 scoring, fixed-point impact rules, cross-scope worksheets, MCP, user studies, and public release gates remain future work. No live data is fetched during domain operations.

## Repository scaffold

The original generic scaffold remains in `template/` for reference; it is not application code. Existing ownership configuration is preserved.
