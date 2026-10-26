import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../apps/cli/src/main.js";
import { DatabaseSync } from "node:sqlite";
import {
  packSchema,
  requestSchema,
  responseSchema,
  ids,
  type Pack,
} from "../packages/contracts/src/index.js";
import {
  validatePack,
  canTransition,
  composePacks,
  DomainError,
} from "../packages/domain/src/index.js";
import {
  MemoryReleaseRepository,
  SqliteReleaseRepository,
  verifyPack,
  sha256,
  canonicalJson,
} from "../packages/storage/src/index.js";
import { execute } from "../packages/application/src/index.js";
import { handleJson } from "../adapters/json/src/index.js";
import { evaluateConformance } from "../packages/evaluation/src/index.js";
import { loadPack, readBoundedJson } from "../packages/ingest/src/index.js";

const fixture = loadPack("packs/synthetic/pack.json");
const originalRequest = JSON.parse(
  readFileSync("packs/synthetic/request.json", "utf8"),
) as Record<string, unknown>;
const clone = (): Pack => structuredClone(fixture);
const repo = () => new MemoryReleaseRepository([clone()]);
function request(operation: string, inputs: Record<string, unknown> = {}) {
  return { ...originalRequest, operation, inputs };
}
function code(input: unknown, repository = repo()) {
  const result = execute(input, repository);
  assert.equal(result.ok, false);
  if (result.ok) throw Error("Expected failure");
  return result.error.code;
}
function invalid(pack: Pack) {
  assert.throws(
    () => verifyPack(pack),
    (e: unknown) => e instanceof DomainError && e.code === "INVALID_PACK",
  );
}

test("synthetic pack, source originals, hashes, and approved citations validate offline", () => {
  assert.equal(packSchema.safeParse(fixture).success, true);
  assert.deepEqual(validatePack(fixture), fixture);
  for (const snapshot of fixture.snapshots) {
    assert.equal(sha256(snapshot.content), snapshot.hash);
    assert.equal(
      readFileSync(
        `packs/synthetic/snapshots/${snapshot.hash.slice(7)}.txt`,
        "utf8",
      ),
      snapshot.content,
    );
  }
  assert.equal(fixture.synthetic, true);
  assert.match(fixture.title, /^SYNTHETIC:/);
});
test("all identifier kinds require a namespaced kind, not a display label", () => {
  for (const [kind, schema] of Object.entries(ids)) {
    assert.equal(schema.safeParse(`${kind}:synthetic:record`).success, true);
    assert.equal(schema.safeParse("A").success, false);
    assert.equal(schema.safeParse("measure:demo").success, false);
  }
});
const invalidPackCases: Record<string, (p: Pack) => unknown> = {
  "duplicate measure ID": (p) => p.measures.push(p.measures[0]!),
  "finding election mismatch": (p) => {
    p.findings[0]!.scope.electionId = "election:synthetic:other";
  },
  "missing measure": (p) => {
    p.findings[0]!.measureId = "measure:synthetic:absent";
  },
  "excerpt mismatch": (p) => {
    p.findings[0]!.evidence[0]!.excerpt = "not in the source";
  },
  "citation beyond text": (p) => {
    p.findings[0]!.evidence[0]!.end = 9999;
  },
  "tampered snapshot": (p) => {
    p.snapshots[0]!.content += "tamper";
  },
  "missing snapshot hash": (p) => {
    p.sources[0]!.snapshotHash = "sha256:" + "0".repeat(64);
  },
  "model approval": (p) => {
    p.reviewEvents[1]!.actorType = "model";
  },
  "missing review history": (p) => {
    p.reviewEvents = [];
  },
  "reviewer mismatch": (p) => {
    p.reviewEvents[1]!.actor = "different reviewer";
  },
  "out-of-order review": (p) => {
    p.reviewEvents[1]!.at = "2098-01-01T00:00:00Z";
  },
  "missing synthetic label": (p) => {
    p.title = "Real measures";
  },
};
for (const [label, mutate] of Object.entries(invalidPackCases))
  test(`invalid pack: ${label}`, () => {
    const p = clone();
    mutate(p);
    invalid(p);
  });
test("approval requires a human and terminal states cannot revive", () => {
  assert.equal(canTransition("draft", "approved", "human"), false);
  assert.equal(canTransition("in_review", "approved", "model"), false);
  assert.equal(canTransition("in_review", "approved", "human"), true);
  for (const state of ["retracted", "superseded", "rejected"] as const)
    assert.equal(canTransition(state, "approved", "human"), false);
});
test("source revisions invalidate current dependencies but do not mutate the old release", () => {
  const p = clone();
  const newer = { ...p.sources[0]!, id: "source_revision:synthetic:text-v2" };
  p.sources.push(newer);
  p.sources[0]!.supersededBy = newer.id;
  invalid(p);
  p.findings[0]!.stale = true;
  p.measures[0]!.coverage = "stale";
  verifyPack(p);
  const result = execute(
    request("get_evidence", { measureId: p.measures[0]!.id }),
    new MemoryReleaseRepository([p]),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.coverage, "stale");
    assert.deepEqual((result.data as { items: unknown[] }).items, []);
  }
  assert.equal(fixture.findings[0]!.stale, false);
});
test("corrections preserve old finding history and expose only the approved new revision", () => {
  const p = clone();
  const old = p.findings[0]!;
  old.state = "superseded";
  p.reviewEvents.push({
    id: "event:synthetic:supersede",
    findingRevisionId: old.id,
    actor: "Synthetic human reviewer",
    actorType: "human",
    from: "approved",
    to: "superseded",
    at: "2099-01-02T00:00:00Z",
    reason: "Synthetic correction",
  });
  const correction = {
    ...structuredClone(old),
    id: "finding_revision:synthetic:duration-v2",
    state: "approved" as const,
    supersedes: old.id,
    reviewedAt: "2099-01-02T00:00:00Z",
  };
  p.findings.push(correction);
  for (const event of fixture.reviewEvents)
    p.reviewEvents.push({
      ...event,
      id: event.id + "-v2",
      findingRevisionId: correction.id,
      at: correction.reviewedAt,
    });
  const result = execute(
    request("get_evidence", { measureId: old.measureId }),
    new MemoryReleaseRepository([p]),
  );
  assert.equal(result.ok, true);
  if (result.ok)
    assert.deepEqual(
      (result.data as { items: { id: string }[] }).items.map((f) => f.id),
      [correction.id],
    );
});
test("draft, rejected, and retracted findings do not appear as current evidence", () => {
  for (const terminal of ["rejected", "retracted"] as const) {
    const p = clone();
    const f = p.findings[0]!;
    if (terminal === "rejected") p.reviewEvents.pop();
    p.reviewEvents.push({
      id: "event:synthetic:terminal",
      findingRevisionId: f.id,
      actor: "Synthetic human reviewer",
      actorType: "human",
      from: terminal === "rejected" ? "in_review" : "approved",
      to: terminal,
      at: "2099-01-02T00:00:00Z",
      reason: "Synthetic terminal state",
    });
    f.state = terminal;
    p.measures[0]!.coverage = "pending";
    const result = execute(
      request("get_measure_brief", { measureId: f.measureId }),
      new MemoryReleaseRepository([p]),
    );
    assert.equal(result.ok, true);
    if (result.ok)
      assert.deepEqual((result.data as { findings: unknown[] }).findings, []);
  }
});
test("pack composition rejects duplicate packs, conflicting versions, IDs, and missing dependencies", () => {
  assert.throws(() => composePacks([clone(), clone()]));
  const other = clone();
  other.id = "pack:synthetic:other";
  other.releaseId = "release:synthetic:other";
  assert.throws(() => composePacks([clone(), other]));
  const dependency = clone();
  dependency.dependencies = [
    {
      packId: "pack:synthetic:missing",
      releaseId: "release:synthetic:missing",
    },
  ];
  assert.throws(() => composePacks([dependency]));
  const version = clone();
  version.releaseId = "release:synthetic:v2";
  assert.throws(() => composePacks([clone(), version]));
});
test("memory storage isolates callers and fixture mutations", () => {
  const p = clone();
  const repository = new MemoryReleaseRepository([p]);
  const ref = originalRequest.releases as {
    packId: string;
    releaseId: string;
  }[];
  p.findings = [];
  const first = repository.getRelease(ref[0]!) as Pack;
  first.findings = [];
  assert.equal((repository.getRelease(ref[0]!) as Pack).findings.length, 2);
});
test("SQLite persists immutable pinned releases, allows idempotent import, and retains old releases", () => {
  const dir = mkdtempSync(join(tmpdir(), "ballot-sqlite-"));
  const path = join(dir, "releases.db");
  try {
    const db = new SqliteReleaseRepository(path);
    db.importPack(fixture);
    db.importPack(clone());
    const altered = clone();
    altered.title += " changed";
    assert.throws(() => db.importPack(altered));
    altered.releaseId = "release:synthetic:demo-v2";
    db.importPack(altered);
    db.close();
    const reopened = new SqliteReleaseRepository(path);
    assert.deepEqual(
      reopened.getRelease({ packId: fixture.id, releaseId: fixture.releaseId }),
      fixture,
    );
    assert.equal(
      (
        reopened.getRelease({
          packId: altered.id,
          releaseId: altered.releaseId,
        }) as Pack
      ).title,
      altered.title,
    );
    reopened.close();
    const raw = new DatabaseSync(path);
    assert.throws(() => raw.exec("DELETE FROM releases"));
    assert.throws(() => raw.exec("UPDATE releases SET document='{}'"));
    raw.exec("PRAGMA recursive_triggers=OFF");
    assert.throws(
      () =>
        raw
          .prepare("INSERT OR REPLACE INTO releases VALUES (?, ?, ?, ?)")
          .run(fixture.id, fixture.releaseId, "tampered", "{}"),
      /immutable release/,
    );
    assert.throws(
      () =>
        raw
          .prepare("REPLACE INTO releases VALUES (?, ?, ?, ?)")
          .run("pack:synthetic:collision", fixture.releaseId, "tampered", "{}"),
      /immutable release/,
    );
    assert.equal(
      raw
        .prepare("SELECT document FROM releases WHERE release_id = ?")
        .get(fixture.releaseId)?.document,
      canonicalJson(fixture),
    );
    raw.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("SQLite refuses future schema versions", () => {
  const dir = mkdtempSync(join(tmpdir(), "ballot-version-"));
  try {
    const path = join(dir, "future.db");
    const raw = new DatabaseSync(path);
    raw.exec("PRAGMA user_version=99");
    raw.close();
    assert.throws(() => new SqliteReleaseRepository(path));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("canonical serialization is key-order independent", () =>
  assert.equal(
    canonicalJson({ b: 1, a: { y: 2, x: 3 } }),
    canonicalJson({ a: { x: 3, y: 2 }, b: 1 }),
  ));
test("requests reject versions, wrong scopes, missing releases, unknown fields and malformed input", () => {
  assert.equal(
    code({ ...originalRequest, contractVersion: "2.0.0" }),
    "UNSUPPORTED_VERSION",
  );
  assert.equal(
    code({ ...originalRequest, contractVersion: "0.2.0" }),
    "UNSUPPORTED_VERSION",
  );
  assert.equal(
    code({
      ...originalRequest,
      scope: { ...fixture.scope, electionId: "election:synthetic:other" },
    }),
    "SCOPE_MISMATCH",
  );
  assert.equal(
    code({
      ...originalRequest,
      releases: [
        { packId: fixture.id, releaseId: "release:synthetic:missing" },
      ],
    }),
    "MISSING_RELEASE",
  );
  assert.equal(
    code({ ...originalRequest, profile: { private: "never echoed" } }),
    "INVALID_INPUT",
  );
  assert.equal(
    code(
      request("get_measure_brief", { measureId: "measure:synthetic:absent" }),
    ),
    "SCOPE_MISMATCH",
  );
  assert.equal(code(null), "INVALID_INPUT");
  assert.equal(handleJson("{private invalid JSON", repo()).ok, false);
});
test("unsupported operations report unavailable, never empty data or calculated scores", () => {
  const pending = {
    list_organizations: {},
    get_endorsements: { measureId: fixture.measures[0]!.id },
    calculate_endorsement_lens: {
      measureId: fixture.measures[0]!.id,
      organizations: [],
    },
    list_circumstance_questions: { measureId: fixture.measures[0]!.id },
    evaluate_personal_impact: {
      measureId: fixture.measures[0]!.id,
      answers: {},
    },
    build_worksheet: {
      measureId: fixture.measures[0]!.id,
      organizations: [],
      answers: {},
    },
  };
  for (const [operation, inputs] of Object.entries(pending))
    assert.equal(code(request(operation, inputs)), "UNAVAILABLE_ANALYSIS");
});
test("input weights and circumstance values are bounded, with explicit unknown distinct from false", () => {
  const base = { measureId: fixture.measures[0]!.id };
  for (const weight of [-1, 4, 1.5])
    assert.equal(
      code(
        request("calculate_endorsement_lens", {
          ...base,
          organizations: [
            { organizationId: "organization:synthetic:demo", weight },
          ],
        }),
      ),
      "INVALID_INPUT",
    );
  for (const answer of [false, true, "unknown", 0])
    assert.equal(
      requestSchema.safeParse(
        request("evaluate_personal_impact", {
          ...base,
          answers: { demo: answer },
        }),
      ).success,
      true,
    );
  assert.equal(
    code(
      request("evaluate_personal_impact", {
        ...base,
        answers: Object.fromEntries(
          Array.from({ length: 101 }, (_, i) => [String(i), true]),
        ),
      }),
    ),
    "INVALID_INPUT",
  );
});
test("reserved worksheet accepts bounded input shapes and remains unavailable", () => {
  // TODO(M2-01/M3-01): exercise evidence invariance with functioning lens and impact calculations.
  for (const weight of [0, 1, 2, 3])
    for (const value of [undefined, false, true, "unknown"]) {
      const inputs = {
        measureId: fixture.measures[0]!.id,
        organizations: [
          { organizationId: "organization:synthetic:demo", weight },
        ],
        answers: value === undefined ? {} : { demo: value },
      };
      assert.equal(
        code(request("build_worksheet", inputs)),
        "UNAVAILABLE_ANALYSIS",
      );
    }
  assert.equal(
    code({
      ...originalRequest,
      inputs: { measureId: fixture.measures[0]!.id, answers: { demo: true } },
    }),
    "INVALID_INPUT",
  );
});
test("deterministic ordering, pagination, and pending coverage are explicit", () => {
  const first = execute(request("list_measures", { limit: 1 }), repo());
  assert.equal(first.ok, true);
  if (first.ok) {
    const data = first.data as {
      items: { id: string }[];
      pagination: { nextOffset: number | null };
    };
    assert.equal(data.items[0]!.id, "measure:synthetic:demo-a");
    assert.equal(data.pagination.nextOffset, 1);
    assert.equal(first.coverage, "incomplete");
  }
  const second = execute(
    request("list_measures", { offset: 1, limit: 1 }),
    repo(),
  );
  if (second.ok)
    assert.equal(
      (second.data as { pagination: { nextOffset: number | null } }).pagination
        .nextOffset,
      null,
    );
  const pending = execute(
    request("get_measure_brief", { measureId: "measure:synthetic:demo-b" }),
    repo(),
  );
  assert.equal(pending.ok, true);
  if (pending.ok) assert.equal(pending.coverage, "pending");
});
test("source locator resolves only from current approved findings", () => {
  const locator = fixture.findings[0]!.evidence[0]!;
  const result = execute(request("get_source_locator", { locator }), repo());
  assert.equal(result.ok, true);
  if (result.ok)
    assert.equal(
      (result.data as { source: { id: string } }).source.id,
      locator.sourceRevisionId,
    );
  assert.equal(
    code(
      request("get_source_locator", {
        locator: { ...locator, section: "unlinked locator" },
      }),
    ),
    "UNAVAILABLE_ANALYSIS",
  );
});
test("request size, cancellation and generic errors never echo sensitive input", () => {
  const secret = "sensitive-profile-value";
  const result = handleJson(
    JSON.stringify({ ...originalRequest, private: secret }),
    repo(),
  );
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.equal(handleJson("x".repeat(1_048_577), repo()).ok, false);
  const cancelled = execute(originalRequest, repo(), { cancelled: () => true });
  assert.equal(cancelled.ok, false);
  if (!cancelled.ok) assert.equal(cancelled.error.code, "CANCELLED");
  const internal = execute(originalRequest, {
    getRelease: () => {
      throw Error(secret);
    },
  });
  assert.equal(internal.ok, false);
  if (!internal.ok) {
    assert.equal(internal.error.code, "INTERNAL_ERROR");
    assert.equal(internal.error.message, "Operation could not be completed.");
  }
  assert.ok(!JSON.stringify(internal).includes(secret));
});
test("real packs cannot be served before editorial authorization is implemented", () => {
  const p = clone();
  p.synthetic = false;
  p.reviewStatus = "approved";
  p.title = "Proposed real release";
  assert.equal(
    code(originalRequest, new MemoryReleaseRepository([p])),
    "UNAVAILABLE_ANALYSIS",
  );
  p.sources[0]!.rights = "unknown";
  invalid(p);
});
test("application, JSON, and CLI outputs match committed golden responses for every operation", () => {
  const requests = JSON.parse(
    readFileSync("packs/synthetic/requests.json", "utf8"),
  ) as unknown[];
  const goldens = JSON.parse(
    readFileSync("packs/synthetic/responses.json", "utf8"),
  ) as unknown[];
  assert.equal(requests.length, 11);
  assert.equal(goldens.length, requests.length);
  const dir = mkdtempSync(join(tmpdir(), "ballot-golden-"));
  try {
    for (const [index, request] of requests.entries()) {
      const expected = responseSchema.parse(goldens[index]);
      assert.equal(
        evaluateConformance(execute(request, repo()), expected),
        true,
      );
      assert.equal(
        evaluateConformance(
          handleJson(JSON.stringify(request), repo()),
          expected,
        ),
        true,
      );
      const path = join(dir, "request.json");
      writeFileSync(path, JSON.stringify(request));
      let output = "";
      const status = run(
        ["request", "packs/synthetic/pack.json", path],
        (value) => {
          output = value;
        },
      );
      assert.equal(status, expected.ok ? 0 : 1);
      assert.equal(evaluateConformance(JSON.parse(output), expected), true);
    }
    const brief = responseSchema.parse(goldens[2]);
    assert.equal(brief.ok, true);
    assert.equal(evaluateConformance({ ...brief, warnings: [] }, brief), false);
    assert.equal(evaluateConformance({ ok: true }, brief), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("core dependencies stay transport and infrastructure independent", () => {
  for (const path of [
    "packages/domain/src/index.ts",
    "packages/contracts/src/index.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(
      source,
      /from ['"](?:node:|.*(?:storage|ingest|application|adapters|apps)\/|@modelcontextprotocol|react|openai)/,
    );
  }
});

test("every declared operation has a valid fixture and a schema-valid response", () => {
  const fixtures = JSON.parse(
    readFileSync("packs/synthetic/requests.json", "utf8"),
  ) as unknown[];
  assert.equal(fixtures.length, 11);
  for (const input of fixtures) {
    assert.equal(requestSchema.safeParse(input).success, true);
    assert.equal(
      responseSchema.safeParse(execute(input, repo())).success,
      true,
    );
  }
});

test("cyclic source history and self-dependent packs are rejected", () => {
  const p = clone();
  const first = p.sources[0]!;
  const second = {
    ...first,
    id: "source_revision:synthetic:cycle-v2",
    supersededBy: first.id,
  };
  first.supersededBy = second.id;
  p.sources.push(second);
  p.findings[0]!.stale = true;
  p.measures[0]!.coverage = "stale";
  invalid(p);
  const self = clone();
  self.dependencies = [{ packId: self.id, releaseId: self.releaseId }];
  invalid(self);
});
test("application rejects invalid repository data and substituted release pins", () => {
  const invalidData = execute(originalRequest, { getRelease: () => ({}) });
  assert.equal(invalidData.ok, false);
  if (!invalidData.ok) assert.equal(invalidData.error.code, "INVALID_PACK");
  const alternate = clone();
  alternate.releaseId = "release:synthetic:substituted";
  const substituted = execute(originalRequest, { getRelease: () => alternate });
  assert.equal(substituted.ok, false);
  if (!substituted.ok) assert.equal(substituted.error.code, "INVALID_PACK");
});

test("citation bounds cannot rely on slice clamping and timestamp ordering is chronological", () => {
  const p = clone();
  const locator = p.findings[0]!.evidence[0]!;
  const snapshot = p.snapshots[0]!;
  locator.excerpt = snapshot.content.slice(locator.start);
  locator.end = snapshot.content.length + 1;
  invalid(p);
  const fractional = clone();
  fractional.reviewEvents[1]!.at = "2099-01-01T00:00:00.100Z";
  fractional.findings[0]!.reviewedAt = fractional.reviewEvents[1]!.at;
  verifyPack(fractional);
});
test("unsupported pack schema and CLI failures are explicit and do not expose input", () => {
  assert.throws(() => verifyPack({ ...clone(), schemaVersion: "2.0.0" }));
  let output = "";
  assert.equal(
    run(["validate", "/missing/sensitive-profile-path"], (value) => {
      output = value;
    }),
    1,
  );
  assert.ok(!output.includes("sensitive-profile-path"));
  assert.equal(responseSchema.safeParse(JSON.parse(output)).success, true);
});

test("CLI usage is visible, safe, and distinct from file processing errors", () => {
  for (const args of [
    [],
    ["request"],
    ["unknown", "private-path"],
    ["validate", "private-path", "extra"],
  ]) {
    let output = "";
    assert.equal(
      run(args, (value) => {
        output = value;
      }),
      1,
    );
    const result = responseSchema.parse(JSON.parse(output));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "INVALID_INPUT");
      assert.equal(
        result.error.message,
        "Usage: validate PACK | request PACK REQUEST | import PACK DATABASE",
      );
    }
    assert.ok(!output.includes("private-path"));
  }
  assert.equal(code(undefined), "INVALID_INPUT");
});
test("stored hash corruption is rejected after an operator bypasses write guards", () => {
  const dir = mkdtempSync(join(tmpdir(), "ballot-tamper-"));
  try {
    const path = join(dir, "releases.db");
    const db = new SqliteReleaseRepository(path);
    db.importPack(fixture);
    db.close();
    const raw = new DatabaseSync(path);
    raw.exec("DROP TRIGGER releases_no_update");
    const altered = clone();
    altered.title += " tampered";
    raw
      .prepare("UPDATE releases SET document=? WHERE release_id=?")
      .run(canonicalJson(altered), fixture.releaseId);
    raw.close();
    const reopened = new SqliteReleaseRepository(path);
    try {
      assert.throws(
        () =>
          reopened.getRelease({
            packId: fixture.id,
            releaseId: fixture.releaseId,
          }),
        /Stored release hash mismatch/,
      );
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("bounded local reads reject oversized files, directories, missing files and malformed JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "ballot-bounds-"));
  const rejects = (path: string, expected: string) =>
    assert.throws(
      () => readBoundedJson(path),
      (e: unknown) => e instanceof DomainError && e.code === expected,
    );
  try {
    const oversized = join(dir, "oversized.json");
    writeFileSync(oversized, Buffer.alloc(1_048_577, 32));
    rejects(oversized, "PAYLOAD_TOO_LARGE");
    rejects(dir, "INVALID_INPUT");
    rejects(join(dir, "missing"), "INVALID_INPUT");
    const invalid = join(dir, "invalid.json");
    writeFileSync(invalid, "not JSON");
    rejects(invalid, "INVALID_INPUT");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("unrelated version-zero databases are not adopted or modified", () => {
  const dir = mkdtempSync(join(tmpdir(), "ballot-unrelated-"));
  try {
    const path = join(dir, "unrelated.db");
    const raw = new DatabaseSync(path);
    raw.exec(
      "CREATE TABLE unrelated(value TEXT); INSERT INTO unrelated VALUES ('keep');",
    );
    raw.close();
    assert.throws(() => new SqliteReleaseRepository(path), /Refusing to adopt/);
    const unchanged = new DatabaseSync(path);
    assert.equal(
      unchanged.prepare("PRAGMA user_version").get()?.user_version,
      0,
    );
    assert.equal(
      unchanged.prepare("SELECT value FROM unrelated").get()?.value,
      "keep",
    );
    assert.deepEqual(
      unchanged
        .prepare("SELECT name FROM sqlite_schema WHERE type='table'")
        .all()
        .map((r) => r.name),
      ["unrelated"],
    );
    unchanged.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("structural contracts enforce one election, namespaced event IDs, and explicit review origins", () => {
  const multiple = clone();
  multiple.elections.push({
    ...multiple.elections[0]!,
    id: "election:synthetic:other",
  });
  assert.equal(packSchema.safeParse(multiple).success, false);
  const badId = clone();
  badId.reviewEvents[0]!.id = "free text";
  assert.equal(packSchema.safeParse(badId).success, false);
  const nullOrigin = {
    ...clone(),
    reviewEvents: fixture.reviewEvents.map((event, index) =>
      index === 0 ? { ...event, from: null } : event,
    ),
  };
  assert.equal(packSchema.safeParse(nullOrigin).success, false);
});
