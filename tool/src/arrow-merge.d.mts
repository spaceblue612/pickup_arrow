import type { Arrow, Cell, Stage } from './types';
export function planArrowMerge(stage: Stage, incoming: Arrow): {
  stage: Stage; keptId: string; removedId: string; cell: Cell;
} | null;
