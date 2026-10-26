# Ballot Lens — Implementation Roadmap

Version: 0.1 | Date: 2026-10-26 | Audience: Codex and human maintainers
Companion: Ballot Lens — Product and Engineering Requirements — v0.1 — 2026-10-26.md
Status: Proposed implementation plan. Gates are acceptance targets, not measured results.

## 1. Direction and scope

Build an interface-independent ballot analysis core with three separate outputs: reviewed evidence; user-weighted organizational endorsements; and provision-linked personal applicability and impact. Organizations affect endorsement balance only. Circumstances affect applicability only. Neither changes evidence findings. Never combine the layers into a vote recommendation.

Sequence: San Francisco local ballot measures, then California statewide propositions. California expansion does not mean all California local elections. Candidates, voter registration, polling logistics, and address-based ballot assignment are out of scope. Use explicit jurisdiction/election selection. Treat November 2026 as a pilot corpus, not a forced public-launch deadline. Verify actual official measures and versions before ingesting.

Split interfaces from domain logic. Do not select MCP versus Claude artifact versus web application now. MCP is a possible transport/adapter; a Claude artifact or web app is a possible presentation client. They may coexist. Deliver CLI and JSON contracts as test harnesses, not as the final consumer interface.

## 2. Milestones and dependency order

### M0 — Repository, contracts, and source inventory
Owner: Codex; human product/editorial approval. Depends on: none.
- Add AGENTS.md, architecture decision records, contribution policy, CI, formatting, type checks, and fixture tests.
- Proposed default: TypeScript strict mode, schema-validated JSON, SQLite for local authoritative storage, content-addressed source files. Record alternatives before changing this baseline. No graph database or vector service required.
- Create packages/domain, packages/contracts, packages/ingest, packages/storage, packages/evaluation, apps/cli, adapters, and packs.
- Specify stable identifiers, source locators, review transitions, pack format, and operation envelopes from the requirements doc.
- Inventory official SF measures and source versions; record rights and gaps. Pick 2–3 contrasting measures, not an assumed proposition list.
Exit: one synthetic pack validates; an independent checkout runs offline tests; no UI or model provider is required.

### M1 — Reviewed SF evidence vertical slice
Owner: Codex for ingestion; human editors for findings. Depends on M0.
- Ingest official text, fiscal analysis, arguments/rebuttals, and selected contextual evidence with immutable snapshots and exact excerpts.
- Implement candidate extraction, manual review, disagreement records, corrections, source supersession, and release validation.
- Start with approximately 30–50 material claims across the pilot; adjust to coverage, not a quota.
- Export measure briefs with documented unknowns and traceable material assertions.
Exit: each published finding has an approved revision and resolvable evidence locator; a source revision invalidates dependent current findings without destroying the old release. Human reviewer approves the pilot corpus.

### M2 — Organizational lens
Owner: Codex plus human endorsement verifier. Depends on M1.
- Publish a bounded organization directory with inclusion rules, aliases, and disclosure metadata.
- Add sourced, dated endorsement records, distinct no-endorsement states, weights, balance, coverage, and contribution breakdown.
- Default to equal weights; allow explicit 0–3 weights; no inferred preferences.
Exit: deterministic tests cover all edge cases; users can reproduce every total; changing weights cannot change evidence.

### M3 — Personal applicability and impact
Owner: Codex; legal/fiscal reviewer for relevant rules. Depends on M1; can run alongside M2.
- Implement reviewed predicates, three-valued applicability, optional minimal questions, fixed-point calculations, timing, dependencies, and scenario comparisons.
- Include at least one directly applicable rule and one conditional implementation-dependent rule. Do not invent dollar estimates for indirect effects.
Exit: missing information never defaults to no impact; model-free tests reproduce calculations; each rule links to provisions and human review.

### M4 — Integrated SF pilot and independent evaluation
Owner: Codex plus editorial lead and research owner. Depends on M2 and M3.
- Produce a single transport-neutral worksheet response containing three independent layers and explicit display semantics.
- Export Markdown/JSON for inspection; optionally use a disposable evaluation renderer with text alternatives to shading. This does not select the production interface.
- Compare evidence-only, endorsement-table, weighted-lens, and personal-impact conditions; compare reviewed core outputs with ordinary RAG on the same sources if generation is trialed.
- Pre-register tasks, comprehension questions, sample/recruitment approach, and release thresholds before examining outcomes. Include opposed preferences and skipped circumstances.
Exit: all deterministic safety gates pass; user-study findings and limitations are documented. No public claims of demonstrated benefit before results.

### M5 — Complete the SF local-measure pack
Owner: editorial lead with Codex automation. Depends on M4 technical gates; public release depends on human approval.
- Inventory every official SF local measure for the selected election. Publish coverage status per measure; reviewed, pending, and unavailable must be distinguishable.
- Expand evidence and rule coverage, correction runbooks, accessible export, and freshness monitoring. Claim complete coverage only against the reconciled official inventory.
Exit: 100% of inventoried local measures are represented; incomplete analysis is visibly labeled; published content passes provenance and reviewer gates; reviewer-hours and update costs are reported.

### M6 — California statewide propositions
Owner: state editorial reviewer plus Codex. Depends on M4 contracts and M5 pack pattern.
- Create a separate statewide pack using official California sources and state-specific review. Do not copy SF assumptions or organization positions.
- Start with two contrasting statewide measures, then reconcile and represent every official statewide proposition in the chosen election.
- Compose SF and statewide packs into a worksheet without ID collisions, duplicate state measures, or cross-scope endorsement leakage.
Exit: same domain operations work without SF-specific code paths; all propositions are represented with honest review status; independent maintainer reproduces the pack.

### M7 — Interface decision and adapters
Owner: product owner; Codex for adapter spikes. Depends on stable M4 contracts; may run alongside later editorial expansion.
- Compare MCP adapter, Claude artifact client, and web client on privacy, grounding enforcement, accessibility, deployment effort, and review-state visibility.
- Use identical fixture packs and contract responses. Keep business rules in the core.
Exit: decision record selects one or more adapters; adapter contract tests pass; no requirement to rewrite domain logic.

## 3. Release gates and measurement

Hard engineering gates: zero unsupported published fixture assertions; 100% resolvable citations in release validation; no publication of unreviewed/retracted records as current findings; evidence invariance under all weight/profile fixture permutations; exact deterministic math; snapshot-isolated releases; no raw preference/profile logging. These targets are bounded to tested/published artifacts, not guarantees about all future answers.

Human gates: editorial approval, source-rights review, threat-model review, and jurisdiction-specific legal review before public launch. User testing must check that shading is not interpreted as certainty, missing endorsements are noticed, and personal benefit is not mistaken for a recommendation. Failure blocks the affected feature, not necessarily the evidence viewer.

Track claim review hours, rules review hours, correction turnaround, source-update lag, applicability completeness, endorsement coverage, unsupported-answer rate if generation is enabled, and comprehension/calibration. Dates are not delivery commitments; estimate effort after M1 using actual editorial throughput.

## 4. Codex execution instructions

Implement in milestone-sized pull requests. Each PR names requirements covered, migrations, tests, fixtures, limitations, and human review needed. Do not auto-approve editorial content, fabricate endorsements, publish synthetic measures as real, choose a consumer interface, or introduce an LLM dependency into domain calculations. Start M0 with schema and synthetic tests; request human approval for real pilot measure selection and review rubric. Maintain an issue backlog with dependencies and owners.

## 5. Context and source entry points

- Original brief: https://docs.google.com/document/d/1wB3gK-Y1fSFgW4q49lJVxijx_aLtCjkwQAGxH2ojhcg/edit
- Merits assessment: https://drive.google.com/file/d/1iLiafRtzIzUJTgK6DknhidlmhxPRN3ml/view
- SF official measure inventory: https://www.sf.gov/qualified-ballot-measures
- California official voter guide: https://voterguide.sos.ca.gov/
- California fiscal analyses: https://lao.ca.gov/ballotanalysis

These are discovery starting points, not assertions of present completeness or redistribution rights. The roadmap is derived from the project discussion and assessment, not a new source audit.
