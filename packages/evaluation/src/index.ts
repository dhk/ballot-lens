import {
  type ReleaseRepository,
  execute,
} from "../../application/src/index.js";
import { handleJson } from "../../../adapters/json/src/index.js";
// A second non-MCP client exercises the exact application request boundary.
export function evaluateConformance(
  request: unknown,
  repository: ReleaseRepository,
): boolean {
  return (
    JSON.stringify(execute(request, repository)) ===
    JSON.stringify(handleJson(JSON.stringify(request), repository))
  );
}
