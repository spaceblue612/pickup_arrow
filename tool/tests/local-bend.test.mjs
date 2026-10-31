import test from "node:test";
import assert from "node:assert/strict";
import { moveBendLocally, resizeBend, deleteBend } from "../src/arrow-geometry.mjs";
const expand = vertices => vertices.flatMap((point, i) => {
  if (!i) return [[...point]];
  const previous = vertices[i - 1], dx = point[0] - previous[0], dy = point[1] - previous[1];
  return Array.from({ length: Math.abs(dx) + Math.abs(dy) }, (_, n) => [previous[0] + Math.sign(dx) * (n + 1), previous[1] + Math.sign(dy) * (n + 1)]);
});
const vertices = [[2,1],[6,1],[6,3],[10,3],[10,6],[12,6]];
const cells = expand(vertices), index = cells.findIndex(c => c[0] === 6 && c[1] === 3);
test("local corner movement adjusts both neighboring lines while keeping outer corners and endpoints fixed", () => {
  for (const [delta, expected] of [
    [[-1,0], [[2,1],[5,1],[5,3],[10,3],[10,6],[12,6]]],
    [[0,1], [[2,1],[6,1],[6,4],[10,4],[10,6],[12,6]]],
    [[-1,1], [[2,1],[5,1],[5,4],[10,4],[10,6],[12,6]]],
    [[1,-1], [[2,1],[7,1],[7,2],[10,2],[10,6],[12,6]]],
  ]) {
    assert.deepEqual(moveBendLocally(cells, index, delta), expand(expected));
  }
  assert.deepEqual(cells, expand(vertices), "input is immutable");
  assert.notDeepEqual(resizeBend(cells, index, [-1,0])[0], cells[0], "default spacing retains its original group movement");
});
test("local movement works symmetrically when direction is reversed or axes are rotated", () => {
  const expected = expand([[2,1],[5,1],[5,4],[10,4],[10,6],[12,6]]);
  for (const transform of [([x,y]) => [x,y], ([x,y]) => [y,-x], ([x,y]) => [-x,-y], ([x,y]) => [-y,x]]) {
    for (const reverse of [false, true]) {
      const source = cells.map(transform), result = expected.map(transform);
      if (reverse) { source.reverse(); result.reverse(); }
      assert.deepEqual(moveBendLocally(source, reverse ? cells.length - 1 - index : index, transform([-1,1])), result);
    }
  }
});
test("crossed segments and moves requiring a diagonal endpoint connection are rejected", () => {
  for (const delta of [[-5,0],[0,-3],[0,4],[5,0]]) assert.equal(moveBendLocally(cells, index, delta), null);
  const short = expand([[2,1],[6,1],[6,3],[10,3]]);
  assert.equal(moveBendLocally(short, 4, [0,1]), null);
  assert.equal(moveBendLocally(cells, 0, [1,0]), null);
  assert.deepEqual(moveBendLocally(cells, index, [0,0]), cells);
});
test("deleting a bend reconnects through the opposite corner and matches collapsed local movement", () => {
  const expected = expand([[2,1],[10,1],[10,6],[12,6]]);
  for (const transform of [([x,y]) => [x,y], ([x,y]) => [y,-x], ([x,y]) => [-x,-y], ([x,y]) => [-y,x]]) {
    for (const reverse of [false, true]) {
      const source = cells.map(transform), result = expected.map(transform);
      if (reverse) { source.reverse(); result.reverse(); }
      const selected = reverse ? cells.length - 1 - index : index;
      assert.deepEqual(deleteBend(source, selected), result);
      assert.deepEqual(moveBendLocally(source, selected, transform([4,-2])), result);
    }
  }
  assert.deepEqual(cells, expand(vertices));
  assert.equal(deleteBend(cells, 0), null);
  assert.equal(deleteBend(cells, 1), null);
});
test("a collapsed adjacent segment straightens, while a lone bend uses an orthogonal replacement", () => {
  assert.deepEqual(moveBendLocally(cells, index, [0,-2]), expand([[2,1],[10,1],[10,6],[12,6]]));
  assert.deepEqual(moveBendLocally(cells, index, [4,0]), expand([[2,1],[10,1],[10,6],[12,6]]));
  const short = expand([[2,1],[6,1],[6,3]]);
  assert.deepEqual(deleteBend(short, 4), expand([[2,1],[2,3],[6,3]]));
});
test("a deletion that would retrace the body is rejected", () => {
  const source = expand([[2,1],[6,1],[6,3],[4,3],[4,5]]);
  assert.equal(deleteBend(source, source.findIndex(([x,y]) => x === 6 && y === 3)), null);
});
test("diagonal dragging of a straightened bend adds both elbows with all other corners fixed", () => {
  const source = expand([[2,1],[10,1],[10,6],[12,6]]);
  const expected = expand([[2,1],[8,1],[8,3],[10,3],[10,6],[12,6]]);
  const selected = 8;
  for (const transform of [([x,y]) => [x,y], ([x,y]) => [y,-x], ([x,y]) => [-x,-y], ([x,y]) => [-y,x]]) {
    for (const reverse of [false, true]) {
      const input = source.map(transform), result = expected.map(transform);
      if (reverse) { input.reverse(); result.reverse(); }
      assert.deepEqual(moveBendLocally(input, reverse ? source.length - 1 - selected : selected, transform([-2,2])), result);
    }
  }
  assert.deepEqual(source, expand([[2,1],[10,1],[10,6],[12,6]]));
});
test("diagonal elbow insertion also works when both adjoining points are endpoints", () => {
  const source = expand([[2,1],[10,1],[10,6]]);
  assert.deepEqual(moveBendLocally(source, 8, [-2,2]), expand([[2,1],[8,1],[8,3],[10,3],[10,6]]));
  assert.deepEqual(moveBendLocally(source, 8, [0,0]), source);
});
