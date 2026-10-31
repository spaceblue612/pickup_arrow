// Retry replaces the latest generated batch; it never rolls back the entire board.
export function generatedIdsForTarget(draft, targetId) {
  if (!draft) return [];
  if (draft.placementBatch && draft.placementBatch.targetId !== targetId) return [];
  const recorded = new Set(draft.placementBatch?.arrowIds ?? Object.keys(draft.placementGroups ?? {}).filter(id => ['primary', 'filler'].includes(draft.placementGroups[id])));
  const arrows = draft.stage.arrows.filter(arrow => recorded.has(arrow.id));
  if (!draft.placementBatch && targetId) {
    const region = draft.regions.find(region => region.id === targetId);
    if (!region) return [];
    const cells = new Set(region.cells.map(cell => cell.join(',')));
    if (arrows.some(arrow => arrow.cells.some(cell => !cells.has(cell.join(','))))) return [];
  }
  return arrows.map(arrow => arrow.id);
}
export function prepareRegeneration(draft, targetId) {
  const ids = new Set(generatedIdsForTarget(draft, targetId));
  if (!ids.size) throw Error('선택한 대상에서 교체할 최근 생성분이 없습니다.');
  const stage = structuredClone(draft.stage);
  stage.arrows = stage.arrows.filter(arrow => !ids.has(arrow.id));
  return stage;
}
