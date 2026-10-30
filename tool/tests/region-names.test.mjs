import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRegionName, repairRegions } from '../src/region-names.mjs';
const region = (name, id = name, cells = [[1, 1]]) => ({ id, name, cells });
test('deleting earlier regions never reuses a surviving name', () => {
  let regions = [region('영역 1'), region('영역 2')];
  regions.shift();
  assert.equal(nextRegionName(regions), '영역 3');
  regions.push(region(nextRegionName(regions)));
  regions.shift();
  assert.equal(nextRegionName(regions), '영역 4');
});
test('legacy empty and duplicate regions are repaired without changing geometry or IDs', () => {
  const regions = [region('영역 3', 'empty', []), region('영역 3', 'a'), region('영역 3', 'b', [[2, 1]])];
  const original = structuredClone(regions);
  const result = repairRegions(regions);
  assert.deepEqual(result.map(r => r.name), ['영역 3', '영역 4']);
  assert.deepEqual(result.map(r => r.id), ['a', 'b']);
  assert.deepEqual(result.map(r => r.cells), [[[1, 1]], [[2, 1]]]);
  assert.deepEqual(regions, original);
});
