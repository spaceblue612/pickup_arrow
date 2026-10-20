import test from "node:test";
import assert from "node:assert/strict";
import { readFile, chmod } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CoreHost } from "../src/core-host.mjs";
const project = fileURLToPath(new URL("../../", import.meta.url));
const settings = {
  godot: process.env.ARROW_GODOT || "godot",
  project,
  timeoutMs: 15000,
};
const stage = JSON.parse(
  await readFile(
    new URL("../../docs/wireframes/examples/role_chain.json", import.meta.url),
    "utf8",
  ),
);
const fixture = fileURLToPath(new URL("./fake-godot.mjs", import.meta.url));
if (process.platform !== "win32") await chmod(fixture, 0o755);
test(
  "timeout and wrong request ID are not treated as successful analysis",
  { skip: process.platform === "win32" },
  async () => {
    const host = new CoreHost();
    await assert.rejects(
      host.run(
        { operation: "analyze_stage", stage },
        { godot: fixture, project: "hang", timeoutMs: 1000 },
      ),
      /시간 제한/,
    );
    assert.equal(host.busy, false);
    await assert.rejects(
      host.run(
        { operation: "analyze_stage", stage },
        { godot: fixture, project: "한글 경로 with spaces", timeoutMs: 2000 },
      ),
      /요청 ID/,
    );
    assert.equal(host.busy, false);
  },
);
test("host calls real Godot with unique response and shared rules", async () => {
  const host = new CoreHost(),
    response = await host.run({ operation: "analyze_stage", stage }, settings);
  assert.equal(response.validation.valid, true);
  assert.deepEqual(response.analysis.available_arrow_ids, ["Z"]);
  assert.equal(response.analysis.solution_status, "solved");
  assert.equal(host.busy, false);
  const result = await host.run(
    { operation: "apply_action", stage, arrow_id: "G" },
    settings,
  );
  assert.equal(result.action.event, "blocked");
  assert.equal(result.action.stage.arrows.length, 6);
});
test("host rejects concurrent requests and cancellation leaves it reusable", async () => {
  const host = new CoreHost(),
    first = host.run({ operation: "analyze_stage", stage }, settings);
  await assert.rejects(
    host.run({ operation: "analyze_stage", stage }, settings),
    /진행 중/,
  );
  host.cancel();
  await assert.rejects(first, /취소/);
  assert.equal(host.busy, false);
  const next = await host.run({ operation: "validate_stage", stage }, settings);
  assert.equal(next.validation.valid, true);
});
test("unknown operations and missing executable are surfaced, not simulated", async () => {
  const host = new CoreHost();
  await assert.rejects(
    host.run({ operation: "generate_stage", stage }, settings),
    /지원하지/,
  );
  await assert.rejects(
    host.run(
      { operation: "analyze_stage", stage },
      { ...settings, godot: "/missing godot;not-a-shell" },
    ),
    /ENOENT/,
  );
  assert.equal(host.busy, false);
});
