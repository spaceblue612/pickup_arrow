import test from 'node:test';
import assert from 'node:assert/strict';
import { generatedIdsForTarget, prepareRegeneration } from '../src/placement-retry.mjs';
const arrow = (id, x) => ({ id, head_cell: [x, 1], direction: 'UP', cells: [[x, 1], [x, 2]] });
const draft = () => ({ stage: { id: 'S', grid_size: [5, 5], blocked_cells: [], arrows: [arrow('original',1), arrow('primary',2), arrow('filler',3), arrow('manual',4)] }, regions: [{ id: 'R', cells: [[2,1],[2,2],[3,1],[3,2]] }], roles: {}, targets: {}, placementGroups: { original: 'existing', primary: 'primary', filler: 'filler' }, placementBatch: { targetId: 'R', arrowIds: ['primary','filler'] } });
test('regeneration removes only last generated batch and preserves original and later manual arrows', () => {
  const input = draft(), original = structuredClone(input);
  assert.deepEqual(prepareRegeneration(input,'R').arrows.map(a=>a.id), ['original','manual']);
  assert.deepEqual(input, original);
  assert.deepEqual(generatedIdsForTarget(input,''), []);
  assert.throws(()=>prepareRegeneration(input,''));
});
test('older phase records are usable only when all generated arrows fit the target', () => {
  const input = draft(); delete input.placementBatch;
  assert.equal(generatedIdsForTarget(input,'R').length,2);
  input.regions[0].cells = [[2,1],[2,2]];
  assert.deepEqual(generatedIdsForTarget(input,'R'),[]);
  assert.equal(generatedIdsForTarget(input,'').length,2);
});
