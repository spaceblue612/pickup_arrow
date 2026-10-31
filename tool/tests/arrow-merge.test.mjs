import test from "node:test";
import assert from "node:assert/strict";
import { planArrowMerge } from "../src/arrow-merge.mjs";
import { directionFromCells } from "../src/arrow-geometry.mjs";
const arrow = (id, cells) => ({ id, cells, head_cell: cells[0], direction: directionFromCells(cells) });
const a = arrow("A", [[3,3], [4,3], [5,3], [6,3], [7,3]]);
const b = arrow("B", [[5,1], [5,2], [5,3], [5,4], [5,5]]);
test("one crossing keeps A's head and B's tail, trims both unused branches atomically", () => {
  const stage = { arrows: [a, b] }, snapshot = structuredClone(stage);
  const result = planArrowMerge(stage, b);
  assert.deepEqual(result.stage.arrows, [arrow("A", [[3,3],[4,3],[5,3],[5,4],[5,5]])]);
  assert.deepEqual(result.cell, [5,3]);
  assert.equal(result.removedId, "B");
  assert.deepEqual(stage, snapshot);
});
test("new arrows can join at an endpoint and the new head direction is derived", () => {
  const target = arrow("A", [[3,3],[4,3]]);
  const incoming = arrow("B", [[3,2],[3,3],[3,4]]);
  const result = planArrowMerge({ arrows: [target] }, incoming);
  assert.deepEqual(result.stage.arrows, [arrow("A", [[3,3],[3,4]])]);
  assert.equal(result.stage.arrows[0].direction, "UP");
});
test("two or more contacts, including contacts with different arrows, cannot merge", () => {
  assert.equal(planArrowMerge({ arrows: [a] }, arrow("B", [[4,3],[5,3]])), null);
  assert.equal(planArrowMerge({ arrows: [a, arrow("C", [[5,5],[6,5]])] }, b), null);
});
test("no contact, self intersection and a one-cell result cannot merge", () => {
  assert.equal(planArrowMerge({ arrows: [a] }, arrow("B", [[1,1],[1,2]])), null);
  assert.equal(planArrowMerge({ arrows: [a] }, arrow("B", [[5,2],[5,3],[5,2]])), null);
  assert.equal(planArrowMerge({ arrows: [a] }, arrow("B", [[3,2],[3,3]])), null);
});
