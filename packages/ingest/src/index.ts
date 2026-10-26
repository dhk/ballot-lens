import { readFileSync, statSync } from "node:fs";
import { MAX_BYTES } from "../../contracts/src/index.js";
import { verifyPack } from "../../storage/src/index.js";
import { DomainError, fail } from "../../domain/src/index.js";

// Local operator-selected files only. No URL resolution, network fetch, or editorial approval.
export function readBoundedJson(path: string): unknown {
  try {
    const stat = statSync(path);
    if (!stat.isFile())
      fail("INVALID_INPUT", "Local input must be a regular file.");
    if (stat.size > MAX_BYTES)
      fail("PAYLOAD_TOO_LARGE", "Local input exceeds 1 MiB.");
    const bytes = readFileSync(path);
    if (bytes.length > MAX_BYTES)
      fail("PAYLOAD_TOO_LARGE", "Local input exceeds 1 MiB.");
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (
      error instanceof SyntaxError ||
      (error instanceof Error &&
        "code" in error &&
        ["ENOENT", "ENOTDIR", "EACCES", "EISDIR"].includes(String(error.code)))
    ) {
      fail("INVALID_INPUT", "Local JSON input could not be read.");
    }
    throw error;
  }
}
export function loadPack(path: string) {
  return verifyPack(readBoundedJson(path));
}
