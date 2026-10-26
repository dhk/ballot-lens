import {
  errorResponse,
  MAX_BYTES,
  type Response,
} from "../../../packages/contracts/src/index.js";
import {
  execute,
  type ReleaseRepository,
  type ExecutionContext,
} from "../../../packages/application/src/index.js";
export function handleJson(
  body: string,
  repository: ReleaseRepository,
  context?: ExecutionContext,
): Response {
  if (new TextEncoder().encode(body).length > MAX_BYTES)
    return errorResponse("PAYLOAD_TOO_LARGE", "Request exceeds 1 MiB.");
  try {
    return execute(JSON.parse(body) as unknown, repository, context);
  } catch {
    return errorResponse("INVALID_INPUT", "Invalid JSON.");
  }
}
