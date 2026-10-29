import type { Cell, Region } from './types';
export type RegionEdge = { cells: Cell[]; dx: number; dy: number };
export function findRegionEdge(cells: Cell[], pos: Cell, tolerance: number): RegionEdge | null;
export function edgeChange(edge: RegionEdge, distance: number, region: Cell[], otherRegions: Region[], grid: Cell): { mode: 'add-region' | 'remove-region'; cells: Cell[] } | null;
