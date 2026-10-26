import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { format } from "prettier";
import {
  packSchema,
  requestSchema,
  responseSchema,
  answers,
} from "../packages/contracts/src/index.js";
mkdirSync("packages/contracts/schemas", { recursive: true });
for (const [name, schema] of Object.entries({
  pack: packSchema,
  request: requestSchema,
  response: responseSchema,
})) {
  const path = `packages/contracts/schemas/${name}.schema.json`;
  const content = await format(
    JSON.stringify(
      z.toJSONSchema(schema, {
        io: name === "request" ? "input" : "output",
        override: (ctx) => {
          if (ctx.zodSchema === answers) ctx.jsonSchema.maxProperties = 100;
        },
      }),
    ),
    { parser: "json" },
  );
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8") !== content)
      throw new Error(`Schema drift: ${path}`);
  } else writeFileSync(path, content);
}
