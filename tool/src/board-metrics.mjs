// Presentation counts only. Legality and removability still come from Godot.
/** @param {import("./types").Stage} stage */
export function summarizeCells(stage) {
  const [width, height] = stage.grid_size;
  const inBounds = ([x, y]) => x >= 1 && x <= width && y >= 1 && y <= height;
  const blocked = new Set(
    stage.blocked_cells.filter(inBounds).map((cell) => cell.join(",")),
  );
  const occupied = new Set(
    stage.arrows.flatMap((arrow) =>
      arrow.cells
        .filter(inBounds)
        .map((cell) => cell.join(","))
        .filter((cell) => !blocked.has(cell)),
    ),
  );
  const usable = width * height - blocked.size;
  return {
    blocked: blocked.size,
    usable,
    occupied: occupied.size,
    empty: usable - occupied.size,
    coverage: usable ? Math.round((occupied.size / usable) * 100) : 0,
  };
}

/** @param {import('./types').Stage} stage
 * @param {import('./types').Cell[] | undefined} cells
 * @param {import('./types').Draft['placementGroups']} groups */
export function summarizePlacement(stage, cells, groups) {
  const [width, height] = stage.grid_size;
  const scope = new Set((cells ?? Array.from({ length: width * height }, (_, i) => [i % width + 1, Math.floor(i / width) + 1]))
    .filter(([x, y]) => x >= 1 && y >= 1 && x <= width && y <= height).map(cell => cell.join(',')));
  const blocked = new Set(stage.blocked_cells.map(cell => cell.join(',')));
  const usable = new Set([...scope].filter(cell => !blocked.has(cell)));
  const occupied = new Set();
  const phases = { existing: new Set(), primary: new Set(), filler: new Set() };
  for (const arrow of stage.arrows) {
    const phase = groups?.[arrow.id] ?? 'existing';
    for (const cell of arrow.cells) {
      const id = cell.join(',');
      if (usable.has(id)) { occupied.add(id); phases[phase].add(id); }
    }
  }
  const xs = [...scope].map(cell => Number(cell.split(',')[0]));
  const ys = [...scope].map(cell => Number(cell.split(',')[1]));
  const ratio = (count, total) => total > 0 ? Math.round(count / total * 1000) / 10 : 0;
  const initialFree = usable.size - phases.existing.size;
  return {
    arrowCount: stage.arrows.filter(arrow => scope.has(arrow.head_cell.join(','))).length,
    usable: usable.size, occupied: occupied.size, empty: usable.size - occupied.size,
    coverage: ratio(occupied.size, usable.size),
    width: xs.length ? Math.max(...xs) - Math.min(...xs) + 1 : 0,
    height: ys.length ? Math.max(...ys) - Math.min(...ys) + 1 : 0,
    primaryCoverage: groups ? ratio(phases.primary.size, initialFree) : null,
    fillCoverage: groups ? ratio(phases.filler.size, initialFree - phases.primary.size) : null,
  };
}
