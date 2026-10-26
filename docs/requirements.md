# Ballot Lens — Product and Engineering Requirements

Version: 0.1 | Date: 2026-10-26 | Audience: Codex and human maintainers
Status: Proposed requirements, not an implemented system or a source audit.
Companion: Ballot Lens — Implementation Roadmap — v0.1 — 2026-10-26.md

## 1. Product purpose and scope

R-01. Help people understand ballot measures through three independent layers: reviewed evidence; explicitly user-weighted organizational endorsements; and provision-linked personal applicability and impact. Never combine these into a vote recommendation or a personal persuasion score.

R-02. Start with San Francisco local measures; expand through separate California statewide proposition packs. California expansion excludes other local jurisdictions unless separately approved. Require explicit election and jurisdiction selection. Candidates, registration, polling logistics, address-based ballot assignment, and campaign targeting are out of scope. November 2026 is a pilot corpus, not a launch commitment. Reconcile actual official inventories before claiming coverage.

R-03. Default experience must work without organizational preferences or personal circumstances. Missing preferences must not be inferred. Skipping questions must not hide evidence.

## 2. Headless architecture

A-01. Domain logic and versioned contracts are the product foundation. MCP is an adapter, not the domain API or a required runtime. A future web app, Claude artifact client, CLI, or batch process must use the same operations and receive semantically equivalent results. Selecting MCP as an initial integration does not select a final consumer interface.

A-02. Dependency direction: clients -> adapters -> application operations -> domain. Application operations depend on storage/source ports; infrastructure implements those ports. Domain and contracts must not import MCP SDKs, UI frameworks, network clients, storage drivers, model SDKs, or authentication-provider types. Pass execution context explicitly; no hidden session-dependent preferences.

A-03. Proposed baseline: strict TypeScript; schema-validated JSON; SQLite authoritative local storage; content-addressed source snapshots. Separate packages/domain, packages/contracts, packages/ingest, packages/storage, packages/evaluation, apps/cli, adapters, and packs. Record alternatives in architecture decisions. Do not require a vector database, graph database, hosted service, or LLM.

A-04. Domain operations must run offline against a validated release pack. Network retrieval belongs to ingestion or source-resolution infrastructure, never hidden inside endorsement or impact calculations. Inject clocks and other nondeterministic dependencies where needed.

## 3. Data and provenance contracts

D-01. Define stable, namespaced IDs for jurisdiction, election, measure, source, source revision, provision, claim, finding revision, organization, endorsement, impact rule, pack, and release. Measure labels are display attributes, not globally unique IDs. Pack composition must reject collisions and conflicting versions rather than silently overwrite.

D-02. Sources record publisher, title, source URL, retrieval time, effective/publication date when known, content hash, media type, immutable snapshot reference, and rights/reuse status. Evidence locators identify source revision plus exact excerpt and page, section, or stable text offsets. Preserve original documents alongside extracted representations when permitted. Unsupported snapshot redistribution must be flagged and must block affected public distribution until reviewed.

D-03. Findings record proposition/assertion, scope, finding type, evidence links, counterevidence, uncertainty, reviewer, review timestamp, and revision history. Distinguish official text, fiscal estimates, advocacy arguments, contextual evidence, and editorial synthesis. Do not equate official publication with factual verification of an advocacy claim.

D-04. Packs contain manifest and schema versions, jurisdiction/election coverage, release ID, dependency versions, source inventory, records, hashes, review status, and validation results. Releases are immutable and snapshot-isolated. A worksheet must pin every component to one declared release set.

## 4. Review, freshness, and publication

E-01. Support draft -> in_review -> approved, with explicit rejected, superseded, and retracted states. Only authorized humans approve editorial findings, endorsements, and impact rules. Model extraction produces candidates only. Maintain append-only review events identifying actor, action, reason, and affected revision.

E-02. Source changes flag dependent findings/rules for re-review and exclude stale dependencies from newly published current findings until resolved. Preserve prior release content and show historical status clearly. Corrections create revisions; never silently mutate published records.

E-03. Public operations return approved records only and explicitly label reviewed, pending, unavailable, stale, and incomplete coverage. Administrative reads require separate authorization. Generation cannot promote a draft or override a release gate.

## 5. Organizational lens

O-01. Maintain a bounded organization directory with inclusion criteria, aliases, disclosures, and sourced endorsement records tied to a specific measure version/election. Record publication and verification dates. Distinguish support, oppose, neutral, explicitly no endorsement, unknown, and not yet reviewed. Do not infer a parent organization's position from an affiliate.

O-02. Default weights to 1 within the explicitly selected organization set. Permit integer weights 0–3. Let S and P be the sums of weights for verified support and oppose records. Balance = (S - P)/(S + P) when the denominator is positive; otherwise return null with a reason. Return numerator, denominator, per-organization contributions, and separate position buckets. Never silently score unknown, neutral, or no endorsement as opposition.

O-03. Return directional coverage = (S + P)/(sum of all selected organization weights) when that denominator is positive, otherwise null. Also report counts and weights for every status so absence and non-directional positions remain visible. This coverage is not evidence confidence or representativeness. Weight changes must never alter evidence or impact rules.

## 6. Personal applicability and impact

P-01. Ask only optional, minimal circumstance questions needed by reviewed rules. Exclude political affiliation and inferred demographic preferences. Distinguish unanswered, unknown, and explicit negative responses.

P-02. Rule results use applies, does_not_apply, or unknown, with reasons, missing inputs, linked provisions, effective timing, dependencies, and review metadata. Unknown inputs must never default to no impact. A conditional implementation requirement must remain visible even when the user's circumstances match.

P-03. Use deterministic predicates and fixed-point arithmetic with explicit units, periods, rounding, thresholds, and boundary handling. State whether outputs are direct effects, conditional scenarios, or unquantified indirect effects. Do not invent dollar estimates for indirect effects. Scenario comparisons use the same pinned release and identify changed assumptions.

P-04. Profile changes affect applicability and supported calculations only, never findings or organizational positions. Personal benefit is not a recommendation.

## 7. Transport-neutral operations

C-01. Specify JSON schemas and fixtures for list_elections, list_measures, get_measure_brief, get_evidence, list_organizations, get_endorsements, calculate_endorsement_lens, list_circumstance_questions, evaluate_personal_impact, build_worksheet, and get_source_locator. Keep editorial operations in a separate administrative contract.

C-02. Requests include contract version, explicit scope, pinned release references, and operation inputs. Responses include contract version, release references, data, provenance/review metadata, coverage, warnings, and structured errors. Use stable error codes for invalid input, unsupported version, missing release, scope mismatch, unavailable analysis, and invalid pack. Do not confuse an empty result with unavailable data. Define ordering, pagination, null semantics, size limits, and cancellation behavior.

C-03. build_worksheet composes independent evidence, endorsement, and applicability sections; it adds no composite score. Return display semantics as data: metric meaning, denominators, null reasons, limitations, and mandatory warnings. Rendering or shading must not change these meanings. Provide text equivalents for every visual cue.

C-04. Schema versions and pack versions are independent. Reject unsupported major contract versions; declare supported compatibility ranges and migration rules. Validate inputs and outputs at boundaries. Adapter conformance tests compare normalized outputs for identical requests and releases.

## 8. MCP adapter and future interfaces

M-01. Initial MCP scope is a read-only adapter over approved domain operations. Calculations may accept ephemeral user inputs but must not persist them. Tool handlers validate and authorize requests, invoke application operations, and serialize results; they must not implement scoring, rule evaluation, editorial logic, or source selection.

M-02. Publish machine-readable tool schemas and structured responses, with concise human-readable summaries that preserve warnings and review state. Map immutable measure briefs and source locators to resources where useful; avoid returning the full corpus by default. Pin the supported MCP SDK/protocol compatibility in an architecture decision before implementation. No protocol-version assumption is imposed by this document.

M-03. Keep transport concerns in the adapter: lifecycle, cancellation, authentication, errors, payload limits, and optional resource discovery. Choose initial local or remote transport through a threat-model decision; do not require remote hosting for the core. If remote access is introduced, enforce authorization server-side and isolate tenants.

M-04. MCP tool metadata, prompts, and client instructions are not security boundaries. Treat source documents as untrusted data, not executable instructions. The adapter must not expose arbitrary filesystem reads, URL fetching, SQL, code execution, or editorial write tools. Administrative tooling requires a separate authorization and audit design.

M-05. Future HTTP, web, artifact, and batch adapters must conform to the same contracts. Presentation clients may format and collect inputs; they must not independently recalculate balances or applicability. Client-side deployment of the shared deterministic core is permissible if it passes identical conformance tests.

## 9. Privacy, security, and optional generation

S-01. Process preferences and circumstances ephemerally by default. Do not log raw profiles, weights, question answers, or sensitive request bodies in application logs, analytics, traces, or error reports. Disable body capture in intermediaries under project control. Persistence requires explicit opt-in and a separately approved retention/deletion design.

S-02. Use bounded inputs and payloads, source-fetch allowlists and network safeguards for ingestion, least-privilege credentials, and no secrets in packs. Editorial writes require authorization and audit trails. Public launch requires source-rights, security/threat-model, accessibility, and jurisdiction-specific legal review.

S-03. LLMs are optional for candidate extraction or source-grounded explanation, not calculation, approval, or domain execution. Published material assertions require approved supporting evidence. When support is insufficient, return an explicit limitation rather than fabricate an answer. Record model/prompt provenance if generated artifacts enter review.

S-04. External clients can misrepresent returned data; the headless service cannot guarantee their narrative compliance. Certify adapters under project control, preserve structured provenance, and evaluate any generated explanation separately. Never claim system-wide protection merely because tool outputs are grounded.

## 10. Acceptance and release gates

T-01. Independent checkout validates a synthetic pack and runs offline tests without a UI, MCP server, network, or model provider. Synthetic data must be clearly labeled and never published as real measures.

T-02. Fixture tests cover endorsement status combinations, zero/all-zero weights, absent organizations, scope errors, unknown inputs, threshold boundaries, rounding, conditional rules, source supersession, corrections, release isolation, and pack composition.

T-03. Across all declared fixture permutations, changing weights/profile leaves evidence unchanged. Published fixture assertions have approved provenance; citation locators resolve within the tested release. Unreviewed, retracted, or invalidated records cannot appear as current findings. Deterministic calculations match expected outputs exactly. These are bounded release gates, not guarantees about arbitrary future answers.

T-04. CLI and MCP adapter produce equivalent normalized results for shared fixtures. A minimal second non-MCP adapter/test client proves that domain operations do not depend on MCP. No production web UI is required for acceptance.

T-05. Coverage is measured against a reconciled official inventory. Represent every inventoried measure before claiming inventory completeness; distinguish representation from completed analysis. Record review hours, correction turnaround, source-update lag, endorsement coverage, rule completeness, and maintenance effort. Set performance budgets after the M1 baseline rather than inventing unmeasured latency promises.

T-06. Pre-register independent comprehension tests before evaluating interface variants. Check that users distinguish the three layers, notice missing endorsements, understand unknown impact, and do not interpret shading as certainty or benefit as a recommendation. Failed feature-specific gates block that feature. Do not claim demonstrated benefit before results.

## 11. Delivery and decisions

Follow roadmap M0–M7; use milestone-sized PRs with requirements IDs, tests, migrations, limitations, and required human review. M0 establishes contracts and synthetic fixtures; M1 validates actual editorial throughput. Human approval is required for real pilot measures, editorial rubric, organization inclusion, rule review, public releases, and interface selection.

Open decisions: exact pilot measures; reviewer staffing and independence; source redistribution permissions; organization inclusion policy; conditional-rule review expertise; first MCP transport and deployment; compatible protocol/SDK version; performance budgets; public interface selection; any future profile persistence. None may be silently resolved by an implementation agent.

## 12. Basis and companion

This proposed specification derives from the supplied roadmap and the request for a headless core with MCP and future interfaces. It does not assert that linked source inventories or protocol details have been audited. If implementation uncovers a conflict with the roadmap, record it and request human resolution rather than silently changing scope.

Roadmap: https://drive.google.com/file/d/1F9vWrs-6EdiwLBzwGE0fDP5M6lc7FD7q/view
