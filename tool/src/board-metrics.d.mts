import type { Stage } from "./types";

export function summarizeCells(stage: Stage): {
  blocked: number;
  usable: number;
  occupied: number;
  empty: number;
  coverage: number;
};
