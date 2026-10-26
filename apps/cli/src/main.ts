import { errorResponse } from "../../../packages/contracts/src/index.js";
import { pathToFileURL } from "node:url";
import {
  loadPack,
  readBoundedJson,
} from "../../../packages/ingest/src/index.js";
import {
  MemoryReleaseRepository,
  SqliteReleaseRepository,
} from "../../../packages/storage/src/index.js";
import { execute } from "../../../packages/application/src/index.js";
import { DomainError } from "../../../packages/domain/src/index.js";

export function run(args: string[], write: (value: string) => void): number {
  try {
    const [command, packPath, inputPath] = args;
    if (
      !packPath ||
      !["validate", "request", "import"].includes(command ?? "") ||
      args.length !== (command === "validate" ? 2 : 3)
    )
      throw new Error(
        "Usage: validate PACK | request PACK REQUEST | import PACK DATABASE",
      );
    const pack = loadPack(packPath);
    if (command === "validate") {
      write(
        JSON.stringify({
          valid: true,
          packId: pack.id,
          releaseId: pack.releaseId,
          synthetic: pack.synthetic,
        }),
      );
      return 0;
    }
    if (!inputPath) throw new Error("Missing input path.");
    if (command === "import") {
      const db = new SqliteReleaseRepository(inputPath);
      try {
        db.importPack(pack);
      } finally {
        db.close();
      }
      write(JSON.stringify({ imported: true, releaseId: pack.releaseId }));
      return 0;
    }
    const result = execute(
      readBoundedJson(inputPath),
      new MemoryReleaseRepository([pack]),
    );
    write(JSON.stringify(result));
    return result.ok ? 0 : 1;
  } catch (error) {
    // Never include filenames, file contents, request bodies, or personal inputs in errors.
    write(
      JSON.stringify(
        errorResponse(
          error instanceof DomainError ? error.code : "INVALID_INPUT",
          "CLI input could not be processed.",
        ),
      ),
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = run(process.argv.slice(2), (value) =>
    process.stdout.write(`${value}\n`),
  );
