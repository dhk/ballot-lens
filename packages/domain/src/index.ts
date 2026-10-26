import {
  packSchema,
  type Pack,
  type ReviewState,
  type ErrorCode,
} from "../../contracts/src/index.js";

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}
export function fail(code: ErrorCode, message: string): never {
  throw new DomainError(code, message);
}
export function sameScope(a: Pack["scope"], b: Pack["scope"]): boolean {
  return a.electionId === b.electionId && a.jurisdictionId === b.jurisdictionId;
}
const transitions: Record<ReviewState, readonly ReviewState[]> = {
  draft: ["in_review"],
  in_review: ["approved", "rejected"],
  approved: ["superseded", "retracted"],
  rejected: [],
  superseded: [],
  retracted: [],
};
export function canTransition(
  from: ReviewState,
  to: ReviewState,
  actorType: "human" | "model",
): boolean {
  return (
    transitions[from].includes(to) &&
    (to !== "approved" || actorType === "human")
  );
}
export function validatePack(input: unknown): Pack {
  const parsed = packSchema.safeParse(input);
  if (!parsed.success)
    fail("INVALID_PACK", "Pack does not match schema 0.1.0.");
  const pack = parsed.data;
  const ensure = (condition: unknown, message: string) => {
    if (!condition) fail("INVALID_PACK", message);
  };
  const acyclic = (links: Map<string, string | null>) => {
    for (const start of links.keys()) {
      const visited = new Set<string>();
      let current: string | null = start;
      while (current !== null) {
        ensure(!visited.has(current), "Cyclic revision history.");
        visited.add(current);
        current = links.get(current) ?? null;
      }
    }
  };
  acyclic(new Map(pack.sources.map((s) => [s.id, s.supersededBy])));
  acyclic(new Map(pack.findings.map((f) => [f.id, f.supersedes])));
  ensure(
    new Set(pack.dependencies.map((d) => d.packId)).size ===
      pack.dependencies.length &&
      pack.dependencies.every((d) => d.packId !== pack.id),
    "Duplicate or self-referencing pack dependencies.",
  );
  ensure(
    pack.synthetic
      ? pack.reviewStatus === "synthetic" && pack.title.startsWith("SYNTHETIC:")
      : pack.reviewStatus !== "synthetic",
    "Synthetic labeling is inconsistent.",
  );
  const seen = new Set<string>();
  for (const record of [
    ...pack.elections,
    ...pack.measures,
    ...pack.sources,
    ...pack.findings,
    ...pack.reviewEvents,
  ]) {
    ensure(!seen.has(record.id), "Duplicate record ID.");
    seen.add(record.id);
  }
  ensure(
    new Set(pack.snapshots.map((s) => s.hash)).size === pack.snapshots.length,
    "Duplicate snapshot.",
  );
  for (const election of pack.elections)
    ensure(
      election.id === pack.scope.electionId &&
        election.jurisdictionId === pack.scope.jurisdictionId,
      "Election scope mismatch.",
    );
  for (const measure of pack.measures)
    ensure(sameScope(measure.scope, pack.scope), "Measure scope mismatch.");
  for (const source of pack.sources) {
    ensure(
      pack.snapshots.some((s) => s.hash === source.snapshotHash),
      "Missing source snapshot.",
    );
    ensure(
      source.supersededBy === null ||
        (source.supersededBy !== source.id &&
          pack.sources.some(
            (s) =>
              s.id === source.supersededBy && s.sourceId === source.sourceId,
          )),
      "Invalid source supersession.",
    );
  }
  const assertLocator = (
    locator: Pack["findings"][number]["evidence"][number],
  ) => {
    const source = pack.sources.find((s) => s.id === locator.sourceRevisionId);
    const snapshot = pack.snapshots.find(
      (s) => s.hash === source?.snapshotHash,
    );
    ensure(
      snapshot &&
        locator.start < locator.end &&
        locator.end <= snapshot.content.length &&
        snapshot.content.slice(locator.start, locator.end) === locator.excerpt,
      "Unresolvable citation.",
    );
  };
  const currentClaims = new Set<string>();
  for (const finding of pack.findings) {
    ensure(
      pack.measures.some((m) => m.id === finding.measureId) &&
        sameScope(finding.scope, pack.scope),
      "Finding scope mismatch.",
    );
    [...finding.evidence, ...finding.counterevidence].forEach(assertLocator);
    ensure(
      finding.supersedes === null ||
        (finding.supersedes !== finding.id &&
          pack.findings.some(
            (f) =>
              f.id === finding.supersedes &&
              f.claimId === finding.claimId &&
              f.measureId === finding.measureId &&
              ["superseded", "retracted"].includes(f.state),
          )),
      "Invalid finding revision history.",
    );
    const events = pack.reviewEvents.filter(
      (e) => e.findingRevisionId === finding.id,
    );
    let state: ReviewState = "draft";
    let lastTime = Number.NEGATIVE_INFINITY;
    for (const event of events) {
      const time = Date.parse(event.at);
      ensure(time >= lastTime, "Review events are out of order.");
      lastTime = time;
      ensure(
        event.from === state && canTransition(state, event.to, event.actorType),
        "Invalid review transition.",
      );
      state = event.to;
    }
    ensure(
      state === finding.state,
      "Review history does not match finding state.",
    );
    if (finding.state === "approved") {
      const approval = events.findLast((e) => e.to === "approved");
      ensure(
        approval &&
          approval.actorType === "human" &&
          approval.actor === finding.reviewer &&
          approval.at === finding.reviewedAt,
        "Missing approval provenance.",
      );
      if (!finding.stale) {
        ensure(
          !currentClaims.has(finding.claimId),
          "Conflicting current finding revisions.",
        );
        currentClaims.add(finding.claimId);
        ensure(
          [...finding.evidence, ...finding.counterevidence].every(
            (l) =>
              pack.sources.find((s) => s.id === l.sourceRevisionId)
                ?.supersededBy === null,
          ),
          "Current finding depends on superseded source.",
        );
      }
    }
  }
  for (const event of pack.reviewEvents)
    ensure(
      pack.findings.some((f) => f.id === event.findingRevisionId),
      "Orphan review event.",
    );
  for (const measure of pack.measures)
    if (measure.coverage === "reviewed")
      ensure(
        pack.findings.some(
          (f) =>
            f.measureId === measure.id && f.state === "approved" && !f.stale,
        ),
        "Reviewed measure has no current findings.",
      );
  // This is a distribution gate, not a rights inference or editorial approval.
  if (!pack.synthetic && pack.reviewStatus === "approved")
    ensure(
      pack.sources.every((s) => s.rights === "redistributable"),
      "Unreviewed source rights block public distribution.",
    );
  return pack;
}
export function composePacks(inputs: readonly Pack[]): Pack[] {
  const packs = inputs.map(validatePack);
  const names = new Set<string>();
  const releases = new Set<string>();
  const records = new Set<string>();
  for (const pack of packs) {
    if (names.has(pack.id) || releases.has(pack.releaseId))
      fail("INVALID_PACK", "Conflicting pack or release versions.");
    names.add(pack.id);
    releases.add(pack.releaseId);
    for (const record of [
      ...pack.elections,
      ...pack.measures,
      ...pack.sources,
      ...pack.findings,
      ...pack.reviewEvents,
    ]) {
      if (records.has(record.id))
        fail("INVALID_PACK", "Pack composition contains colliding record IDs.");
      records.add(record.id);
    }
  }
  for (const pack of packs)
    for (const dep of pack.dependencies)
      if (
        !packs.some((p) => p.id === dep.packId && p.releaseId === dep.releaseId)
      )
        fail("INVALID_PACK", "Pack dependency is missing or conflicting.");
  return packs;
}
