import { type Response, responseSchema } from "../../contracts/src/index.js";
import { canonicalJson } from "../../storage/src/index.js";

// Compare an adapter's observed output with a committed expected-response fixture.
// Evaluation does not invoke the application or generate its own expected output.
export function evaluateConformance(
  actual: unknown,
  expected: Response,
): boolean {
  const parsed = responseSchema.safeParse(actual);
  return (
    parsed.success && canonicalJson(parsed.data) === canonicalJson(expected)
  );
}
