# Current handoff

Updated: 2026-10-26

PR #1 merged as c015a0e after CI passed on befaa86 (43 tests). Its review fixes cover safe usage/internal errors, committed golden conformance, storage REPLACE guards and integrity tests, snapshot bytes, contract typing and CI pins. M0-01 remains open for maintainer acceptance; the merge did not close it.

The M0 inventory follow-up reconciles A–J against the successfully retrieved Elections qualification page and official pamphlet. `docs/inventory/sf-2026-11-03.sources.json` indexes 119 linked documents: 113 originals captured/hashed, six oversized paid-argument originals metadata-only. Original bytes are held in the cloud cache outside Git, with no real source content redistributed. Rights remain unknown. Amendments/corrections/challenges need editorial comparison, including B's amended fiscal statement and H's corrected rebuttal. RTM remains excluded from the local scope.

`docs/editorial/pilot-review-proposal.md` supplies a concrete draft for the B/G/H pilot and review rubric; neither has been approved, and no real reviewer is authorized. Next: obtain those human decisions, resolve source version/rights/size gaps, and begin M1 only within the approved scope. No real findings, endorsements or rules are approved or served. M0 remains open.

Use Node 24: `npm ci`, then `npm run check`. Runtime remains synthetic-only. Before storing real editorial data, reassess the release-candidate SQLite API and replace the synthetic 1 MiB pack assumption with measured, bounded M1 source/pack handling. See `docs/backlog.md`, `docs/contracts.md`, and ADR 0001.
