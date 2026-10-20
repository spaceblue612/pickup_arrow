import type { Cell, Direction } from "./types";
export const DRAG_THRESHOLD: number;
export function sameCell(a: Cell, b: Cell): boolean;
export function directionFromCells(cells: Cell[]): Direction;
export function appendStroke(path: Cell[], target: Cell): Cell[];
export function rotateGroup(
  cells: Cell[],
  pivotIndex: number,
  part: "head" | "tail",
  clockwise: boolean,
): Cell[];
export function bendInfo(
  cells: Cell[],
  index: number,
): {
  anchor: number;
  axis: Cell;
  length: number;
  tailAnchor: number;
  nextAxis: Cell;
  nextLength: number;
} | null;
export function resizeBend(cells: Cell[], index: number, delta: Cell): Cell[];
export function extendEndpoint(
  cells: Cell[],
  stroke: Cell[],
  part: "head" | "tail",
): Cell[];
