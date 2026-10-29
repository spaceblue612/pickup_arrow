import { appendStroke } from './arrow-geometry.mjs';
const key = ([x, y]) => `${x},${y}`;
export function moveRegion(cells, offset, from, to, otherRegions, grid) {
  const blocked = new Set(otherRegions.flatMap((r) => r.cells).map(key));
  let current = [...offset];
  const path = appendStroke([from], to);
  for (let i = 1; i < path.length; i++) {
    const delta = [path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]];
    const next = [current[0] + delta[0], current[1] + delta[1]];
    if (cells.every(([x, y]) => x + next[0] >= 1 && x + next[1] >= 1 && x + next[0] <= grid[0] && y + next[1] <= grid[1] && !blocked.has(key([x + next[0], y + next[1]])))) current = next;
  }
  return current;
}
