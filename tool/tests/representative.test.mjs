import test from 'node:test';
import assert from 'node:assert/strict';
import { representativeCandidate, representativeStage } from '../src/representative.mjs';
test('stage output follows its representative latest saved version, not candidate order', () => {
  const stage = { id: 'STAGE-001', mainCandidateId: 'C4', candidates: [
    { id: 'C1', versions: [{ draft: { stage: { id: 'STAGE-001', arrows: ['first'] } } }] },
    { id: 'C4', versions: [{ draft: { stage: { arrows: ['old'] } } }, { draft: { stage: { id: 'STAGE-001', arrows: ['representative'] } } }] },
  ] };
  assert.equal(representativeCandidate(stage).id, 'C4');
  const output = representativeStage(stage);
  assert.deepEqual(output.arrows, ['representative']);
  output.arrows.length = 0;
  assert.equal(representativeStage(stage).arrows.length, 1);
  assert.equal(representativeStage({ candidates: [] }), null);
});
