import { readFileSync, statSync } from "node:fs";
import { MAX_BYTES } from "../../contracts/src/index.js";
import { verifyPack } from "../../storage/src/index.js";
import { fail } from "../../domain/src/index.js";

// Local operator-selected files only. No URL resolution, network fetch, or editorial approval.
export function readBoundedJson(path: string): unknown {
  if (!statSync(path).isFile() || statSync(path).size > MAX_BYTES)
    fail(
      "PAYLOAD_TOO_LARGE",
      "Local input exceeds 1 MiB or is not a regular file.",
    );
  const bytes = readFileSync(path);
  if (bytes.length > MAX_BYTES)
    fail("PAYLOAD_TOO_LARGE", "Local input exceeds 1 MiB.");
  return JSON.parse(bytes.toString("utf8")) as unknown;
}
export function loadPack(path: string) {
  return verifyPack(readBoundedJson(path));
}
