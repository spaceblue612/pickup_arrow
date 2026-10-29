import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRegionEdge, edgeChange } from '../src/region-edge.mjs';
test('불규칙한 외곽선은 같은 높이의 연속된 칸만 선택합니다', () => {
  const cells = [[1,2],[2,2],[3,2],[4,2],[5,2],[2,1],[3,1],[4,1]];
  const edge = findRegionEdge(cells, [100, 0], 8);
  assert.deepEqual(new Set(edge.cells.map(String)), new Set(['2,1','3,1','4,1']));
  assert.equal(edgeChange(edge, 25, cells, [], [10,10]), null);
  assert.equal(edgeChange(edge, -25, cells, [], [10,10]).mode, 'remove-region');
  assert.equal(edgeChange(edge, 10, cells, [], [10,10]), null);
});
test('끊어진 외곽선과 단일 칸을 구분합니다', () => {
  const edge = findRegionEdge([[1,1],[3,1]], [20,0], 8);
  assert.deepEqual(edge.cells, [[1,1]]);
});

test('여러 줄을 조절하고 경계와 최소 한 줄에서 멈춥니다', () => {
  const region = [[2,2],[2,3],[2,4]];
  const edge = { cells: [[2,2]], dx: 0, dy: -1 };
  assert.deepEqual(edgeChange(edge, -200, region, [], [6,6]).cells, [[2,2],[2,3]]);
  assert.deepEqual(edgeChange(edge, 200, region, [], [6,6]).cells, [[2,1]]);
  assert.equal(edgeChange(edge, 200, region, [{cells:[[2,1]]}], [6,6]), null);
  assert.equal(edgeChange(edge, -5, region, [], [6,6]), null);
});
