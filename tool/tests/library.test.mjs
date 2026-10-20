import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { LibraryStore, emptyLibrary, checkDraft } from "../src/library.mjs";

const draft = () => ({
  stage: { id: "STAGE-001", grid_size: [5, 5], blocked_cells: [], arrows: [] },
  regions: [],
  roles: {},
  targets: {},
});
async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "arrow-library-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return new LibraryStore(dir);
}
test("missing library is empty; empty drafts save; old versions are immutable", async (t) => {
  const store = await fixture(t),
    initial = await store.load();
  assert.deepEqual(initial, emptyLibrary());
  initial.stages.push({
    id: "STAGE-001",
    archived: false,
    candidates: [
      {
        id: "C1",
        name: "후보 1",
        versions: [{ id: "V1", at: "2026-10-20", draft: draft() }],
      },
    ],
  });
  const saved = await store.save(initial, 0);
  assert.equal(saved.revision, 1);
  assert.equal((await store.load()).stages[0].candidates.length, 1);
  const modified = structuredClone(saved);
  modified.stages[0].candidates[0].versions[0].draft.stage.grid_size = [6, 6];
  await assert.rejects(store.save(modified, 1), /기존 버전/);
  assert.deepEqual(await store.load(), saved);
  const next = structuredClone(saved);
  next.stages[0].candidates[0].versions.push({
    id: "V2",
    at: "2026-10-21",
    draft: draft(),
  });
  await store.save(next, 1);
  assert.equal((await store.load()).stages[0].candidates.length, 1);
  assert.equal(
    JSON.parse(
      await readFile(path.join(store.directory, "library.json.bak"), "utf8"),
    ).revision,
    1,
  );
});
test("stale and concurrent saves cannot overwrite a newer file", async (t) => {
  const store = await fixture(t),
    initial = await store.load();
  const results = await Promise.allSettled([
    store.save(initial, 0),
    store.save(initial, 0),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await store.load()).revision, 1);
});
test("corrupt source is preserved rather than reset", async (t) => {
  const store = await fixture(t),
    file = path.join(store.directory, "library.json");
  await writeFile(file, "broken source");
  await assert.rejects(store.save(emptyLibrary(), 0));
  assert.equal(await readFile(file, "utf8"), "broken source");
});
test("recovery is separate from versions and preserves draft metadata", async (t) => {
  const store = await fixture(t),
    recovery = { stageId: "STAGE-001", candidateId: null, draft: draft() };
  recovery.draft.targets.availableMax = 2;
  await store.recover(recovery);
  assert.deepEqual(await store.recovery(), recovery);
  assert.equal((await store.load()).revision, 0);
  await store.recover(null);
  assert.equal(await store.recovery(), null);
  assert.deepEqual(
    JSON.parse(
      await readFile(path.join(store.directory, "recovery.json.bak"), "utf8"),
    ),
    recovery,
  );
});
test("structural size limits do not pretend to validate gameplay", () => {
  const d = draft();
  d.stage.grid_size = [100, 101];
  assert.throws(() => checkDraft(d), /10,000/);
  d.stage.grid_size = [5, 5];
  d.stage.arrows = [
    { id: "A", head_cell: [2, 2], cells: [[2, 2]], direction: "UP" },
    { id: "B", head_cell: [2, 2], cells: [[2, 2]], direction: "UP" },
  ];
  assert.doesNotThrow(() => checkDraft(d));
});
