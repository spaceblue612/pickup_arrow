export type Cell = [number, number];
export type BoardMode =
  "auto" | "region" | "add-region" | "remove-region" | "mask";
export type BoardEdit = {
  source: Stage;
  kind: "create" | "translate" | "reshape" | "duplicate";
  arrowId?: string;
  cells?: Cell[];
  offset?: Cell;
};
export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
export type Arrow = {
  id: string;
  head_cell: Cell;
  cells: Cell[];
  direction: Direction;
};
export type Stage = {
  id: string;
  grid_size: Cell;
  blocked_cells: Cell[];
  arrows: Arrow[];
};
export type Region = { id: string; name: string; cells: Cell[] };
export type PlacementPhase = "existing" | "primary" | "filler";
export type PlacementSettingsSnapshot = {
  inputs: import("./PlacementControls").PlacementInputs;
  lengthRules: import("./PlacementControls").LengthRules;
  baseLength: { min: string; max: string };
  automaticPlacement: boolean;
};
export type Draft = {
  placementBatch?: { targetId: string; arrowIds: string[] };
  placementSettings?: PlacementSettingsSnapshot;
  placementGroups?: Record<string, PlacementPhase>;
  stage: Stage;
  regions: Region[];
  targets: Record<string, number | null>;
  roles: Record<string, { type: string; region: string }>;
};
export type Version = { id: string; at: string; draft: Draft };
export type Candidate = { id: string; name: string; versions: Version[] };
export type Entry = { mainCandidateId?: string | null; id: string; archived: boolean; candidates: Candidate[] };
export type Library = { schema_version: 1; revision: number; stages: Entry[] };
export type Recovery = {
  stageId: string;
  candidateId: string | null;
  draft: Draft;
};
export type Settings = {
  godot: string;
  project: string;
  timeoutMs: number;
  textSizeOffset: number;
};
export type Analysis = {
  available_arrow_ids: string[];
  blockers_by_arrow: Record<string, string[]>;
  dependents_by_arrow: Record<string, string[]>;
  solution_order: string[];
  dependency_depth: number;
  solution_status: "solved" | "unsolvable";
  path_scope: string;
};
export type Response = {
  validation: { valid: boolean; errors: string[] };
  analysis?: Analysis;
  action?: { event: string; stage: Stage };
  edit?: { accepted: boolean; event: string; errors: string[]; stage: Stage };
  placement?: { groups?: Record<string, PlacementPhase>; deviations?: string[]; attempts?: number; error: string; stage: Stage; primary: PlacementMetrics; final: PlacementMetrics; primary_target: number; primary_added: number; filler_target: number; filler_added: number };
};
export type PlacementMetrics = { arrow_count: number; occupied_tiles: number; contact_count: number; blocked_count: number; blocker_ratio?: number; turn_ratio: number };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface EditorAPI {
  bootstrap(): Promise<
    Result<{
      library: Library;
      lastSelection: { stageId: string; candidateId: string | null } | null;
      recovery: Recovery | null;
      settings: Settings;
      directory: string;
      example: Stage;
    }>
  >;
  rememberSelection(stageId: string, candidateId: string | null): Promise<Result<void>>;
  save(library: Library, expected: number): Promise<Result<Library>>;
  deleteCandidate(stageId: string, candidateId: string, expected: number): Promise<Result<Library>>;
  recover(recovery: Recovery | null): Promise<Result<void>>;
  core(request: {
    operation: string;
    stage: Stage;
    arrow_id?: string;
    offset?: Cell;
    cells?: Cell[];
    placement?: { cells: Cell[]; stage1: number; fill: number; min_length: number; max_length: number; seed: number; settings?: Record<string, unknown> };
  }): Promise<Result<Response>>;
  cancel(): Promise<Result<void>>;
  settings(settings: Settings): Promise<Result<Settings>>;
  importStage(): Promise<Result<Stage | null>>;
  exportStage(stage: Stage): Promise<Result<string | null>>;
}
declare global {
  interface Window {
    arrowEditor: EditorAPI;
  }
}
