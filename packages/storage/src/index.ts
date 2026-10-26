import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  MAX_BYTES,
  type Pack,
  type ReleaseRef,
} from "../../contracts/src/index.js";
import { validatePack, fail } from "../../domain/src/index.js";
import type { ReleaseRepository } from "../../application/src/index.js";

export function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function verifyPack(input: unknown): Pack {
  const pack = validatePack(input);
  if (Buffer.byteLength(JSON.stringify(pack)) > MAX_BYTES)
    fail("INVALID_PACK", "Pack exceeds the M0 1 MiB limit.");
  for (const snapshot of pack.snapshots)
    if (sha256(snapshot.content) !== snapshot.hash)
      fail("INVALID_PACK", "Snapshot hash mismatch.");
  return pack;
}
export class MemoryReleaseRepository implements ReleaseRepository {
  private readonly releases = new Map<string, string>();
  constructor(packs: unknown[]) {
    const releaseIds = new Set<string>();
    for (const input of packs) {
      const pack = verifyPack(input);
      const key = `${pack.id}/${pack.releaseId}`;
      if (this.releases.has(key) || releaseIds.has(pack.releaseId))
        fail("INVALID_PACK", "Duplicate release.");
      releaseIds.add(pack.releaseId);
      this.releases.set(key, JSON.stringify(pack));
    }
  }
  getRelease(ref: ReleaseRef): unknown | undefined {
    const value = this.releases.get(`${ref.packId}/${ref.releaseId}`);
    return value ? (JSON.parse(value) as unknown) : undefined;
  }
}
export class SqliteReleaseRepository implements ReleaseRepository {
  private readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    const migration = this.db.prepare("PRAGMA user_version").get();
    if (Number(migration?.user_version) > 1) {
      this.db.close();
      fail("INVALID_PACK", "Unsupported storage schema version.");
    }
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS releases (pack_id TEXT NOT NULL, release_id TEXT NOT NULL UNIQUE, content_hash TEXT NOT NULL, document TEXT NOT NULL, PRIMARY KEY(pack_id,release_id));
      CREATE TRIGGER IF NOT EXISTS releases_no_update BEFORE UPDATE ON releases BEGIN SELECT RAISE(ABORT, 'immutable release'); END;
      CREATE TRIGGER IF NOT EXISTS releases_no_delete BEFORE DELETE ON releases BEGIN SELECT RAISE(ABORT, 'immutable release'); END;
      PRAGMA user_version = 1;`);
  }
  importPack(input: unknown): void {
    const pack = verifyPack(input);
    const document = canonicalJson(pack);
    const hash = sha256(document);
    const prior = this.db
      .prepare(
        "SELECT content_hash FROM releases WHERE pack_id = ? AND release_id = ?",
      )
      .get(pack.id, pack.releaseId);
    if (prior) {
      if (prior.content_hash !== hash)
        fail("INVALID_PACK", "Release is immutable; use a new release ID.");
      return;
    }
    try {
      this.db
        .prepare("INSERT INTO releases VALUES (?, ?, ?, ?)")
        .run(pack.id, pack.releaseId, hash, document);
    } catch {
      fail("INVALID_PACK", "Release ID collides with existing storage.");
    }
  }
  getRelease(ref: ReleaseRef): unknown | undefined {
    const row = this.db
      .prepare(
        "SELECT document, content_hash FROM releases WHERE pack_id = ? AND release_id = ?",
      )
      .get(ref.packId, ref.releaseId);
    if (!row) return undefined;
    if (
      typeof row.document !== "string" ||
      sha256(row.document) !== row.content_hash
    )
      fail("INVALID_PACK", "Stored release hash mismatch.");
    return verifyPack(JSON.parse(row.document) as unknown);
  }
  close(): void {
    this.db.close();
  }
}
