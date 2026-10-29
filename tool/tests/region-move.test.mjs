import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveRegion } from '../src/region-move.mjs';
test('영역이 격자 단위로 이동하고 경계에서 멈춘 뒤 되돌아옵니다', () => {
  const cells = [[1,1],[2,1]];
  const offset = moveRegion(cells, [0,0], [1,1], [8,1], [], [5,5]);
  assert.deepEqual(offset, [3,0]);
  assert.deepEqual(moveRegion(cells, offset, [8,1], [7,1], [], [5,5]), [2,0]);
});
test('다른 영역을 통과할 수 없으며 화살표와 무관하게 이동합니다', () => {
  const offset = moveRegion([[1,1]], [0,0], [1,1], [5,1], [{cells:[[3,1]]}], [8,8]);
  assert.deepEqual(offset, [1,0]);
  assert.deepEqual(moveRegion([[1,1]], offset, [5,1], [4,1], [{cells:[[3,1]]}], [8,8]), [0,0]);
});
