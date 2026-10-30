import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCells } from "../src/board-metrics.mjs";

const arrow = (cells) => ({
  id: "A",
  head_cell: cells[0],
  cells,
  direction: "LEFT",
});
test("display occupancy counts unique usable cells, not arrow count", () => {
  const stage = {
    id: "STAGE-001",
    grid_size: [4, 3],
    blocked_cells: [
      [4, 3],
      [4, 3],
      [9, 9],
    ],
    arrows: [
      arrow([
        [1, 1],
        [2, 1],
        [2, 1],
      ]),
      arrow([
        [2, 1],
        [3, 1],
        [4, 3],
        [5, 1],
      ]),
    ],
  };
  const original = structuredClone(stage);
  assert.deepEqual(summarizeCells(stage), {
    blocked: 1,
    usable: 11,
    occupied: 3,
    empty: 8,
    coverage: 27,
  });
  assert.deepEqual(
    stage,
    original,
    "display counts never repair invalid draft data",
  );
});
test("empty and fully forbidden boards have finite occupancy", () => {
  const stage = {
    id: "STAGE-001",
    grid_size: [1, 1],
    blocked_cells: [],
    arrows: [],
  };
  assert.deepEqual(summarizeCells(stage), {
    blocked: 0,
    usable: 1,
    occupied: 0,
    empty: 1,
    coverage: 0,
  });
  stage.blocked_cells = [[1, 1]];
  stage.arrows = [arrow([[1, 1]])];
  assert.deepEqual(summarizeCells(stage), {
    blocked: 1,
    usable: 0,
    occupied: 0,
    empty: 0,
    coverage: 0,
  });
});

test('region summaries count heads and clipped bodies and separate generation phases', async () => {
  const { summarizePlacement } = await import('../src/board-metrics.mjs');
  const stage = { id: 'S', grid_size: [4, 2], blocked_cells: [[4, 2]], arrows: [
    { ...arrow([[1, 1], [2, 1]]), id: 'old' },
    { ...arrow([[3, 1], [4, 1]]), id: 'core' },
    { ...arrow([[2, 2], [3, 2]]), id: 'fill' },
  ] };
  const groups = { old: 'existing', core: 'primary', fill: 'filler' };
  const all = summarizePlacement(stage, undefined, groups);
  assert.equal(all.arrowCount, 3);
  assert.equal(all.empty, 1);
  assert.equal(all.primaryCoverage, 40);
  assert.equal(all.fillCoverage, 66.7);
  const region = summarizePlacement(stage, [[2, 1], [3, 1], [2, 2], [3, 2]], groups);
  assert.equal(region.arrowCount, 2);
  assert.equal(region.occupied, 4);
  assert.equal(region.coverage, 100);
  assert.equal(region.width, 2);
  assert.equal(region.height, 2);
  assert.equal(summarizePlacement(stage, []).coverage, 0);
  assert.equal(summarizePlacement(stage).primaryCoverage, null);
});
