const key = ([x, y]) => `${x},${y}`;
export function findRegionEdge(cells, pos, tolerance) {
  const occupied = new Set(cells.map(key));
  let best = null;
  for (const c of cells) for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    if (occupied.has(key([c[0] + dx, c[1] + dy]))) continue;
    const x = (c[0] - 1) * 40, y = (c[1] - 1) * 40;
    const a = dx ? [x + (dx > 0 ? 40 : 0), y] : [x, y + (dy > 0 ? 40 : 0)];
    const b = dx ? [a[0], y + 40] : [x + 40, a[1]];
    const px = Math.max(Math.min(pos[0], Math.max(a[0], b[0])), Math.min(a[0], b[0]));
    const py = Math.max(Math.min(pos[1], Math.max(a[1], b[1])), Math.min(a[1], b[1]));
    const distance = Math.hypot(pos[0] - px, pos[1] - py);
    if (distance <= tolerance && (!best || distance < best.distance)) best = { c, dx, dy, distance };
  }
  if (!best) return null;
  const { c, dx, dy } = best, line = [c];
  const exposed = (v) => occupied.has(key(v)) && !occupied.has(key([v[0] + dx, v[1] + dy]));
  for (const sign of [-1, 1]) {
    let v = [c[0] + sign * (dy ? 1 : 0), c[1] + sign * (dx ? 1 : 0)];
    while (exposed(v)) { line.push(v); v = [v[0] + sign * (dy ? 1 : 0), v[1] + sign * (dx ? 1 : 0)]; }
  }
  return { cells: line, dx, dy };
}
export function edgeChange(edge, distance, region, otherRegions, grid) {
  const steps = Math.floor((Math.abs(distance) + 20) / 40);
  if (!steps) return null;
  const adding = distance > 0;
  const occupied = new Set(region.map(key));
  const blocked = new Set(otherRegions.flatMap((r) => r.cells).map(key));
  const cells = [];
  for (let i = 0; i < steps; i++) {
    const offset = adding ? i + 1 : -i;
    const layer = edge.cells.map(([x, y]) => [x + offset * edge.dx, y + offset * edge.dy]);
    const possible = adding
      ? layer.every(([x, y]) => x >= 1 && y >= 1 && x <= grid[0] && y <= grid[1] && !blocked.has(key([x, y])) && !occupied.has(key([x, y])))
      : layer.every((c) => occupied.has(key(c)) && occupied.has(key([c[0] - edge.dx, c[1] - edge.dy])));
    if (!possible) break;
    cells.push(...layer);
  }
  return cells.length ? { mode: adding ? 'add-region' : 'remove-region', cells } : null;
}
