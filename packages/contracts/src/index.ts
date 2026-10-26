import { z } from "zod";

export const CONTRACT_VERSION = "0.1.0" as const;
export const MAX_BYTES = 1_048_576;
const text = z.string().min(1).max(10_000);
const version = z.string().regex(/^\d+\.\d+\.\d+$/);
export const id = (kind: string) =>
  z
    .string()
    .max(160)
    .regex(
      new RegExp(`^${kind}:[a-z0-9][a-z0-9._-]*(?::[a-z0-9][a-z0-9._-]*)+$`),
    );
export const ids = Object.fromEntries(
  [
    "jurisdiction",
    "election",
    "measure",
    "source",
    "source_revision",
    "provision",
    "claim",
    "finding_revision",
    "organization",
    "endorsement",
    "impact_rule",
    "pack",
    "release",
    "event",
  ].map((kind) => [kind, id(kind)]),
);
export const scopeSchema = z.strictObject({
  jurisdictionId: id("jurisdiction"),
  electionId: id("election"),
});
export const releaseRefSchema = z.strictObject({
  packId: id("pack"),
  releaseId: id("release"),
});
export const reviewStateSchema = z.enum([
  "draft",
  "in_review",
  "approved",
  "rejected",
  "superseded",
  "retracted",
]);
export const coverageSchema = z.enum([
  "reviewed",
  "pending",
  "unavailable",
  "stale",
  "incomplete",
]);
export const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const timestamp = z.iso.datetime();
export const locatorSchema = z.strictObject({
  sourceRevisionId: id("source_revision"),
  excerpt: text,
  start: z.int().min(0),
  end: z.int().min(1),
  section: text.nullable(),
  page: z.int().positive().nullable(),
});
export const sourceSchema = z.strictObject({
  id: id("source_revision"),
  sourceId: id("source"),
  publisher: text,
  title: text,
  url: z.url(),
  retrievedAt: timestamp,
  publishedAt: timestamp.nullable(),
  mediaType: z.literal("text/plain"),
  snapshotHash: hashSchema,
  rights: z.enum(["redistributable", "unknown", "restricted"]),
  supersededBy: id("source_revision").nullable(),
});
export const findingSchema = z.strictObject({
  id: id("finding_revision"),
  claimId: id("claim"),
  measureId: id("measure"),
  assertion: text,
  scope: scopeSchema,
  type: z.enum([
    "official_text",
    "fiscal_estimate",
    "advocacy_argument",
    "contextual_evidence",
    "editorial_synthesis",
  ]),
  evidence: z.array(locatorSchema).min(1).max(100),
  counterevidence: z.array(locatorSchema).max(100),
  uncertainty: text,
  state: reviewStateSchema,
  stale: z.boolean(),
  reviewer: text.nullable(),
  reviewedAt: timestamp.nullable(),
  supersedes: id("finding_revision").nullable(),
});
export const reviewEventSchema = z.strictObject({
  id: id("event"),
  findingRevisionId: id("finding_revision"),
  actor: text,
  actorType: z.enum(["human", "model"]),
  from: reviewStateSchema,
  to: reviewStateSchema,
  at: timestamp,
  reason: text,
});
export const measureSchema = z.strictObject({
  id: id("measure"),
  label: text,
  title: text,
  scope: scopeSchema,
  coverage: coverageSchema,
});
export const electionSchema = z.strictObject({
  id: id("election"),
  jurisdictionId: id("jurisdiction"),
  date: z.iso.date(),
  title: text,
});
export const snapshotSchema = z.strictObject({
  hash: hashSchema,
  content: z.string().max(100_000),
});
export const packSchema = z.strictObject({
  schemaVersion: z.literal("0.1.0"),
  manifestVersion: z.literal("0.1.0"),
  packVersion: version,
  id: id("pack"),
  releaseId: id("release"),
  synthetic: z.boolean(),
  title: text,
  scope: scopeSchema,
  dependencies: z.array(releaseRefSchema).max(20),
  reviewStatus: z.enum(["synthetic", "draft", "approved"]),
  validation: z.strictObject({
    status: z.literal("passed"),
    validatorVersion: z.literal("0.1.0"),
  }),
  elections: z.array(electionSchema).length(1),
  measures: z.array(measureSchema).max(1000),
  sources: z.array(sourceSchema).max(5000),
  snapshots: z.array(snapshotSchema).max(5000),
  findings: z.array(findingSchema).max(10000),
  reviewEvents: z.array(reviewEventSchema).max(20000),
});
export type Pack = z.infer<typeof packSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type Scope = z.infer<typeof scopeSchema>;
export type ReleaseRef = z.infer<typeof releaseRefSchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;

const page = {
  offset: z.int().min(0).default(0),
  limit: z.int().min(1).max(100).default(50),
};
const measureInput = { measureId: id("measure") };
const selection = z
  .array(
    z.strictObject({
      organizationId: id("organization"),
      weight: z.int().min(0).max(3).default(1),
    }),
  )
  .max(100);
export const answers = z
  .record(
    z.string().min(1).max(80),
    z.union([
      z.boolean(),
      z.int().min(-1_000_000_000).max(1_000_000_000),
      z.literal("unknown"),
    ]),
  )
  .refine((value) => Object.keys(value).length <= 100);
const envelope = {
  contractVersion: version,
  scope: scopeSchema,
  releases: z.array(releaseRefSchema).min(1).max(20),
};
export const operationInputs = {
  list_elections: z.strictObject(page),
  list_measures: z.strictObject(page),
  get_measure_brief: z.strictObject(measureInput),
  get_evidence: z.strictObject({ ...measureInput, ...page }),
  list_organizations: z.strictObject(page),
  get_endorsements: z.strictObject({ ...measureInput, ...page }),
  calculate_endorsement_lens: z.strictObject({
    ...measureInput,
    organizations: selection,
  }),
  list_circumstance_questions: z.strictObject({ ...measureInput, ...page }),
  evaluate_personal_impact: z.strictObject({ ...measureInput, answers }),
  build_worksheet: z.strictObject({
    ...measureInput,
    organizations: selection,
    answers,
  }),
  get_source_locator: z.strictObject({ locator: locatorSchema }),
};
export type Operation = keyof typeof operationInputs;
function requestVariant<K extends Operation, S extends z.ZodType>(
  operation: K,
  inputs: S,
) {
  return z.strictObject({
    ...envelope,
    operation: z.literal(operation),
    inputs,
  });
}
export const requestSchema = z.discriminatedUnion("operation", [
  requestVariant("list_elections", operationInputs.list_elections),
  requestVariant("list_measures", operationInputs.list_measures),
  requestVariant("get_measure_brief", operationInputs.get_measure_brief),
  requestVariant("get_evidence", operationInputs.get_evidence),
  requestVariant("list_organizations", operationInputs.list_organizations),
  requestVariant("get_endorsements", operationInputs.get_endorsements),
  requestVariant(
    "calculate_endorsement_lens",
    operationInputs.calculate_endorsement_lens,
  ),
  requestVariant(
    "list_circumstance_questions",
    operationInputs.list_circumstance_questions,
  ),
  requestVariant(
    "evaluate_personal_impact",
    operationInputs.evaluate_personal_impact,
  ),
  requestVariant("build_worksheet", operationInputs.build_worksheet),
  requestVariant("get_source_locator", operationInputs.get_source_locator),
]);
export type Request = z.infer<typeof requestSchema>;
const pagination = z.strictObject({
  offset: z.int().min(0),
  limit: z.int().min(1).max(100),
  nextOffset: z.int().min(0).nullable(),
  total: z.int().min(0),
});
export const errorCodeSchema = z.enum([
  "INVALID_INPUT",
  "INTERNAL_ERROR",
  "UNSUPPORTED_VERSION",
  "MISSING_RELEASE",
  "SCOPE_MISMATCH",
  "UNAVAILABLE_ANALYSIS",
  "INVALID_PACK",
  "CANCELLED",
  "PAYLOAD_TOO_LARGE",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;
const provenance = z.strictObject({
  synthetic: z.boolean(),
  reviewStatus: z.enum(["synthetic", "approved"]),
  sourceRevisionIds: z.array(id("source_revision")),
});
const success = {
  contractVersion: z.literal(CONTRACT_VERSION),
  releases: z.array(releaseRefSchema),
  scope: scopeSchema,
  coverage: coverageSchema,
  warnings: z.array(text),
  provenance,
};
export const responseData = {
  list_elections: z.strictObject({
    items: z.array(electionSchema),
    pagination,
  }),
  list_measures: z.strictObject({ items: z.array(measureSchema), pagination }),
  get_measure_brief: z.strictObject({
    measure: measureSchema,
    findings: z.array(findingSchema),
  }),
  get_evidence: z.strictObject({ items: z.array(findingSchema), pagination }),
  get_source_locator: z.strictObject({
    locator: locatorSchema,
    source: sourceSchema,
  }),
};
const successes = Object.entries(responseData).map(([operation, data]) =>
  z.strictObject({
    ...success,
    ok: z.literal(true),
    operation: z.literal(operation),
    data,
  }),
);
export const errorResponseSchema = z.strictObject({
  contractVersion: z.literal(CONTRACT_VERSION),
  ok: z.literal(false),
  error: z.strictObject({ code: errorCodeSchema, message: text }),
  warnings: z.array(text),
  releases: z.array(releaseRefSchema),
  scope: scopeSchema.nullable(),
  coverage: z.literal("unavailable"),
  provenance: z.null(),
  data: z.null(),
});
export const responseSchema = z.union([errorResponseSchema, ...successes]);
export type Response = z.infer<typeof responseSchema>;

export function errorResponse(code: ErrorCode, message: string): Response {
  return errorResponseSchema.parse({
    contractVersion: CONTRACT_VERSION,
    ok: false,
    error: { code, message },
    warnings: [],
    releases: [],
    scope: null,
    coverage: "unavailable",
    provenance: null,
    data: null,
  });
}
