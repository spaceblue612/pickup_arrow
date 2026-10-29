import test from "node:test";
import assert from "node:assert/strict";
import { selectSmokeSuites, SMOKE_SUITES } from "./smoke-selection.mjs";
import { createSmokeDraft } from "./smoke-fixture.mjs";
import { checkDraft } from "../src/library.mjs";

test("default smoke checks startup without selecting feature suites", () => {
  assert.deepEqual(selectSmokeSuites(), ["startup"]);
});
test("targeted selection never adds unrelated suites", () => {
  assert.deepEqual(selectSmokeSuites("placement"), ["placement"]);
  assert.deepEqual(selectSmokeSuites("placement,layout,placement"), [
    "placement",
    "layout",
  ]);
  for (const suite of SMOKE_SUITES)
    assert.deepEqual(selectSmokeSuites(suite), [suite]);
});
test("only explicit all selects every suite, invalid choices fail", () => {
  assert.deepEqual(selectSmokeSuites("all"), [...SMOKE_SUITES]);
  for (const invalid of [
    "",
    "placment",
    "all,placement",
    "placement,",
    "unknown",
  ])
    assert.throws(() => selectSmokeSuites(invalid), /알 수 없는 화면 테스트/);
});
test("standalone UI fixture satisfies the saved draft contract", async () => {
  const draft = await createSmokeDraft("STAGE-001");
  assert.equal(checkDraft(draft), draft);
  assert.equal(draft.regions[0].cells.length, 35);
  assert.ok(draft.stage.arrows.every((arrow) => arrow.cells.length >= 2));
  draft.stage.arrows[0].cells[0][0] = 99;
  const fresh = await createSmokeDraft("STAGE-002");
  assert.equal(fresh.stage.id, "STAGE-002");
  assert.deepEqual(fresh.stage.arrows[0].cells[0], [1, 1]);
});
