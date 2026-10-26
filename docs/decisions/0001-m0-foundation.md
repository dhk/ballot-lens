# ADR 0001: offline TypeScript foundation

Status: implemented for the M0 technical slice, 2026-10-26.
Requirements: A-01–A-04, D-01–D-04, C-01–C-04, T-01.

Use strict TypeScript and Node 24, with pinned dependencies and a lockfile. Zod owns runtime structural validation and inferred types; generated JSON Schema 2020-12 files are committed and checked for drift. Structural schemas do not replace relational, citation, review-history, or cryptographic validation.

Dependency direction is CLI/JSON adapters → application → domain/contracts. Storage implements an application port. Domain/contracts do not import Node, storage, transport, models, or UI. The extra application package makes the operation boundary explicit. A single npm package keeps M0 setup small; directories define module boundaries until separate workspace publishing is useful.

SQLite is authoritative local release storage, using Node 24's built-in `node:sqlite` synchronous API. Memory storage is an isolated test/CLI pack adapter. SQLite schema version 1 stores canonical pack documents plus SHA-256 hashes, uses unique release IDs, and rejects updates/deletes through triggers. Importing identical content is idempotent; changed content requires a new release ID. Future storage versions are rejected. This is a local integrity design, not protection against an operator who can alter the database file or schema. Exported packs are immutable snapshots, not a live mutable database view.

M0 accepts only bounded UTF-8 plain-text snapshots embedded in packs, with content-addressed original fixture files retained alongside them. Hashes cover original text bytes; offsets are JavaScript UTF-16 code-unit offsets in that exact text (not PDF page coordinates or UTF-8 byte offsets). Content changes require new hashes and source revision IDs. PDF extraction and source retrieval belong to M1.

Alternatives considered: handwritten parallel type/schema definitions invite drift; native SQLite bindings add build dependencies; remote/vector/graph storage is unnecessary for the offline baseline. Schema and pack versions are independent. Only contract/manifest/schema 0.1.0 is supported; adding compatibility or a migration requires fixtures and an explicit decision.

The implementation does not select a consumer interface, MCP SDK/protocol, transport, hosting, editorial rubric, organization policy, real pilot measures, or persistence of personal circumstances. MCP and administrative interfaces are deferred to their own decisions. Real packs cannot be served by M0 public operations until editorial authorization exists.
