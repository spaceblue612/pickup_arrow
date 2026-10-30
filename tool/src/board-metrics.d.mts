import type { Stage } from "./types";

export function summarizeCells(stage: Stage): {
  blocked: number;
  usable: number;
  occupied: number;
  empty: number;
  coverage: number;
};
export function summarizePlacement(stage: Stage, cells?: import('./types').Cell[], groups?: import('./types').Draft['placementGroups']): {
  arrowCount: number; usable: number; occupied: number; empty: number; coverage: number;
  width: number; height: number; primaryCoverage: number | null; fillCoverage: number | null;
};
