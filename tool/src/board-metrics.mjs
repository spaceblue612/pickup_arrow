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
