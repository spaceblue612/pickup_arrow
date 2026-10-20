#!/usr/bin/env node
// Transport failure fixture only; it never implements game rules.
import { readFile, writeFile } from "node:fs/promises";
const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
if (arg("--path") === "hang") setInterval(() => {}, 1000);
else {
  const request = JSON.parse(await readFile(arg("--input"), "utf8"));
  await writeFile(
    arg("--output"),
    JSON.stringify({
      protocol_version: 1,
      request_id: request.request_id + "-wrong",
      ok: true,
      validation: { valid: true, errors: [] },
    }),
  );
}
