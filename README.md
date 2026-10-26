# Ballot Lens

Ballot Lens is a planned, interface-independent tool for understanding ballot measures through three separate layers:

- Reviewed evidence with traceable sources and explicit uncertainty.
- Organizational endorsements weighted only by organizations the user selects.
- Provision-linked personal applicability and impact using optional circumstances.

These layers never combine into a vote recommendation. Changing preferences or circumstances must never change evidence.

The initial scope is San Francisco local measures, followed by separate California statewide proposition packs. November 2026 is a pilot corpus, not a launch commitment.

## Project status

Documentation bootstrap only. No application, validated ballot corpus, schemas, runtime, or test suite has been implemented. The specifications are proposed v0.1 documents; acceptance gates are targets, not measured results.

## Start here

- [Product and engineering requirements](docs/requirements.md)
- [Implementation roadmap](docs/roadmap.md)
- [Document provenance](docs/README.md)
- [Contributing](CONTRIBUTING.md)
- [Agent instructions](AGENTS.md)

## Architecture direction

The proposed baseline is strict TypeScript, schema-validated JSON, SQLite local storage, and content-addressed source snapshots. Dependency direction is clients → adapters → application operations → domain; infrastructure implements storage and source ports.

The core must work offline against validated, immutable release packs without a UI, MCP server, network, or model provider. MCP is a read-only adapter; the consumer interface remains undecided. Planned components are `packages/{domain,contracts,ingest,storage,evaluation}`, `apps/cli`, `adapters`, and `packs`.

## Next milestone

M0 establishes contracts, synthetic fixtures, source inventory, architecture decisions, and development checks. It is not complete in this commit. Follow M0–M7 in the roadmap; real pilot selection and editorial review require human approval.

No installation or test commands are available yet. Add reproducible setup and validation instructions when the implementation tooling is introduced.

## Repository scaffold

The original generic scaffold remains in `template/` for reference; it is not application code. Existing ownership configuration is preserved.
