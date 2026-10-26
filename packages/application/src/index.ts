import {
  errorResponse,
  CONTRACT_VERSION,
  MAX_BYTES,
  requestSchema,
  responseSchema,
  type Pack,
  type ReleaseRef,
  type Response,
  type Finding,
  type ErrorCode,
} from "../../contracts/src/index.js";
import {
  composePacks,
  DomainError,
  fail,
  sameScope,
} from "../../domain/src/index.js";

export interface ReleaseRepository {
  getRelease(ref: ReleaseRef): unknown | undefined;
}
export interface ExecutionContext {
  cancelled: () => boolean;
}
const warnings = [
  "SYNTHETIC DATA: not real ballot measures or human editorial approval.",
];
export function execute(
  input: unknown,
  repository: ReleaseRepository,
  context: ExecutionContext = { cancelled: () => false },
): Response {
  try {
    if (context.cancelled()) fail("CANCELLED", "Operation cancelled.");
    const encoded = JSON.stringify(input);
    if (!encoded || new TextEncoder().encode(encoded).length > MAX_BYTES)
      fail("PAYLOAD_TOO_LARGE", "Request exceeds the 1 MiB limit.");
    if (
      typeof input === "object" &&
      input !== null &&
      "contractVersion" in input &&
      input.contractVersion !== CONTRACT_VERSION
    )
      fail("UNSUPPORTED_VERSION", "Only contract 0.1.0 is supported.");
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success)
      fail("INVALID_INPUT", "Request does not match the operation schema.");
    const request = parsed.data;
    const packs = composePacks(
      request.releases.map((ref) => {
        const pack = repository.getRelease(ref);
        if (pack === undefined)
          fail("MISSING_RELEASE", "Pinned release is unavailable.");
        return pack as Pack;
      }),
    );
    if (
      !packs.every(
        (p, i) =>
          p.id === request.releases[i]?.packId &&
          p.releaseId === request.releases[i]?.releaseId,
      )
    )
      fail("INVALID_PACK", "Repository returned a different release.");
    if (!packs.every((p) => sameScope(p.scope, request.scope)))
      fail(
        "SCOPE_MISMATCH",
        "Pinned release does not match the requested scope.",
      );
    if (packs.some((p) => !p.synthetic || p.reviewStatus === "draft"))
      fail(
        "UNAVAILABLE_ANALYSIS",
        "Real or draft packs require the later editorial authorization workflow.",
      );
    const allMeasures = packs
      .flatMap((p) => p.measures)
      .sort((a, b) => a.id.localeCompare(b.id, "en"));
    const findings = packs
      .flatMap((p) => p.findings)
      .filter((f) => f.state === "approved" && !f.stale)
      .sort((a, b) => a.id.localeCompare(b.id, "en"));
    const inputs = request.inputs as Record<string, unknown>;
    const measure =
      typeof inputs.measureId === "string"
        ? allMeasures.find((m) => m.id === inputs.measureId)
        : undefined;
    if ("measureId" in inputs && !measure)
      fail("SCOPE_MISMATCH", "Measure is not in the pinned release scope.");
    const selected = measure
      ? findings.filter((f) => f.measureId === measure.id)
      : findings;
    const paginate = <T>(items: T[]) => {
      const offset = Number(inputs.offset ?? 0);
      const limit = Number(inputs.limit ?? 50);
      return {
        items: items.slice(offset, offset + limit),
        pagination: {
          offset,
          limit,
          total: items.length,
          nextOffset: offset + limit < items.length ? offset + limit : null,
        },
      };
    };
    let data: unknown;
    let returnedFindings: Finding[] = [];
    switch (request.operation) {
      case "list_elections":
        data = paginate(
          packs
            .flatMap((p) => p.elections)
            .sort((a, b) => a.id.localeCompare(b.id, "en")),
        );
        break;
      case "list_measures":
        data = paginate(allMeasures);
        break;
      case "get_measure_brief":
        data = { measure, findings: selected };
        returnedFindings = selected;
        break;
      case "get_evidence": {
        const result = paginate(selected);
        data = result;
        returnedFindings = result.items;
        break;
      }
      case "get_source_locator": {
        const locator = inputs.locator;
        if (!locator || typeof locator !== "object")
          fail("INVALID_INPUT", "Missing locator.");
        const parsedLocator =
          locator as Pack["findings"][number]["evidence"][number];
        const linked = findings.some((f) =>
          [...f.evidence, ...f.counterevidence].some(
            (l) => JSON.stringify(l) === JSON.stringify(parsedLocator),
          ),
        );
        if (!linked)
          fail(
            "UNAVAILABLE_ANALYSIS",
            "Locator is not linked to a current approved finding.",
          );
        const source = packs
          .flatMap((p) => p.sources)
          .find((s) => s.id === parsedLocator.sourceRevisionId);
        data = { locator: parsedLocator, source };
        break;
      }
      default:
        fail(
          "UNAVAILABLE_ANALYSIS",
          "This operation is specified but not implemented in M0.",
        );
    }
    const coverage =
      measure?.coverage ??
      (allMeasures.length === 0
        ? "unavailable"
        : allMeasures.every((m) => m.coverage === "reviewed")
          ? "reviewed"
          : "incomplete");
    const sourceRevisionIds = [
      ...new Set(
        returnedFindings.flatMap((f) =>
          [...f.evidence, ...f.counterevidence].map((l) => l.sourceRevisionId),
        ),
      ),
    ].sort();
    if (request.operation === "get_source_locator")
      sourceRevisionIds.push(
        (inputs.locator as Pack["findings"][number]["evidence"][number])
          .sourceRevisionId,
      );
    const result = responseSchema.parse({
      contractVersion: CONTRACT_VERSION,
      ok: true,
      operation: request.operation,
      releases: request.releases,
      scope: request.scope,
      coverage,
      warnings: packs.some((p) => p.synthetic) ? warnings : [],
      provenance: {
        synthetic: packs.some((p) => p.synthetic),
        reviewStatus: packs.some((p) => p.synthetic) ? "synthetic" : "approved",
        sourceRevisionIds,
      },
      data,
    });
    if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_BYTES)
      fail("PAYLOAD_TOO_LARGE", "Response exceeds the 1 MiB limit.");
    if (context.cancelled()) fail("CANCELLED", "Operation cancelled.");
    return result;
  } catch (error) {
    const code: ErrorCode =
      error instanceof DomainError ? error.code : "INVALID_INPUT";
    return errorResponse(
      code,
      error instanceof DomainError
        ? error.message
        : "Operation could not be completed.",
    );
  }
}
