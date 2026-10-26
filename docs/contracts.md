# M0 contracts and execution

Authoritative structural schemas live in `packages/contracts/src/index.ts`; generated JSON Schema lives in `packages/contracts/schemas/`. `npm run schemas` regenerates it; `npm run schemas:check` detects drift. Sample requests for all eleven operations live in `packs/synthetic/requests.json`.

## Versions, identifiers, and release pins

Contract, manifest, and schema versions currently accept exactly `0.1.0`. Pack content versions are independent semver strings. Unsupported contract versions return `UNSUPPORTED_VERSION`; unsupported pack schemas return `INVALID_PACK`. No automatic migrations or implied minor-version compatibility exist yet.

IDs follow `kind:namespace:local-id` (with optional further colon segments), bounded to 160 characters, lowercase ASCII letters/digits plus dots, underscores and hyphens. Display labels are never identities. Source revisions and finding revisions are separate from source/claim identities. A new corrected finding links its superseded predecessor and preserves its review events. Pack dependencies pin exact pack/release pairs. Composition conservatively rejects duplicate record IDs, pack IDs, release IDs, or missing dependencies; it never merges shared records silently.

Every request supplies contract version, operation, explicit jurisdiction/election, pinned releases, and operation-specific inputs. Repository implementations must verify snapshot hashes and return isolated copies. Application code independently checks schemas, references, scope, review history, and exact returned release pins. A repository port is trusted infrastructure, not an arbitrary remote payload boundary.

## Available operations

| Operation                                                              | M0 behavior                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `list_elections`                                                       | Elections in the explicit pinned scope                                    |
| `list_measures`                                                        | Measure representation and coverage status                                |
| `get_measure_brief`                                                    | Measure plus current approved, non-stale findings                         |
| `get_evidence`                                                         | Paginated current approved, non-stale findings                            |
| `get_source_locator`                                                   | Source metadata for an exact locator linked to a current approved finding |
| `list_organizations`, `get_endorsements`, `calculate_endorsement_lens` | Validated input, then `UNAVAILABLE_ANALYSIS` until M2                     |
| `list_circumstance_questions`, `evaluate_personal_impact`              | Validated input, then `UNAVAILABLE_ANALYSIS` until M3                     |
| `build_worksheet`                                                      | Validated input, then `UNAVAILABLE_ANALYSIS` until M4                     |

Success responses contain release pins, scope, data, provenance, coverage, and warnings. Synthetic warnings are mandatory. Errors contain a stable code, safe message, empty release list, null scope/data/provenance, unavailable coverage, and warnings; failed requests make no claim about resolved provenance. Unexpected repository or execution failures return `INTERNAL_ERROR` with a generic message, distinct from invalid caller input. No raw input is echoed. Unknown measure IDs yield scope mismatch; missing releases are distinct from empty results. Empty findings plus pending/stale coverage do not mean completed analysis. Public M0 execution is synthetic-only.

Lists sort by ID ascending with explicit English collation and accept offset pagination: default offset 0, default limit 50, maximum 100. `nextOffset: null` means the final page, including an empty page beyond the result set. Collection counts count visible records only. Source metadata cannot be fetched through arbitrary IDs or URLs; the exact locator must already occur in visible evidence.

JSON request/response and pack limits are 1 MiB; schemas also bound collections and strings. Limit errors use `PAYLOAD_TOO_LARGE`; hash/reference/review failures use `INVALID_PACK`. Cancellation is an explicit synchronous execution-context predicate checked before and after computation (`CANCELLED`); there is no streaming or asynchronous cancellation claim. The CLI reads bounded, operator-selected local files. The JSON adapter exposes no filesystem or network tools.

## Review and publication boundaries

Allowed transitions: draft → in_review → approved/rejected; approved → superseded/retracted. Terminal states cannot revive; corrections create revisions. Approval events must identify a human actor, reviewer, reason, and matching timestamp. M0 validates declared fixture histories; it does not authenticate real reviewers or provide editorial writes. A model cannot approve. Review arrays are replayed in order, starting at draft; event origins cannot be null, and event IDs use the `event:namespace:local-id` form. Each M0 pack contains exactly one election matching its scope. Import is immutable; a changed release cannot replace prior events.

Superseded sources invalidate current findings unless they are marked stale; stale findings are excluded from current evidence while remaining in the release. The validator rejects unresolved citations and contradictory current claim revisions. Unknown/restricted source rights block distribution of approved real packs; M0 never grants those rights.

Preference/profile inputs are optional only on their specific future-operation schemas. Weights default to 1 for explicitly selected organizations and are integer 0–3; unanswered questions are omitted, explicit unknown is `"unknown"`, and false remains false. Actual evidence invariance under functioning weight/profile calculations is a TODO for M2-01/M3-01; M0 tests only the reserved input shapes and unavailable-operation boundary. Calculations and associated edge-case gates are deferred; accepting those shapes is not a claim that M2/M3 is implemented. Inputs are not persisted or logged. There is no composite score or recommendation.

## Committed response fixtures

`packs/synthetic/responses.json` records expected outputs paired by index with all eleven requests in `requests.json`. Tests compare application, JSON-adapter, and CLI outputs independently against these fixtures, including the six unavailable results. The evaluation helper never invokes the application or derives its own expectation. Canonical comparison ignores object-key ordering but preserves array ordering and every output field. A deliberately changed response must fail conformance. Update these fixtures only after inspecting and explaining an intentional contract change; they are not regenerated by the normal build or tests.

CLI usage mistakes return `INVALID_INPUT` with a fixed usage string; local missing, malformed or non-regular inputs receive safe input errors. Oversized files return `PAYLOAD_TOO_LARGE`. Unexpected failures receive generic `INTERNAL_ERROR` messages. Help and errors never echo provided arguments.
