export function representativeCandidate(stage) {
  if (!stage) return undefined;
  return stage.candidates.find(candidate => candidate.id === stage.mainCandidateId) ?? stage.candidates[0];
}
export function representativeStage(stage) {
  const candidate = representativeCandidate(stage);
  const draft = candidate?.versions.at(-1)?.draft;
  return draft ? structuredClone(draft.stage) : null;
}
