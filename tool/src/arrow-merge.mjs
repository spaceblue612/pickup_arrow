import { directionFromCells } from "./arrow-geometry.mjs";

// Cells are ordered from head to tail: keep A's prefix and B's suffix.
export function planArrowMerge(stage, incoming) {
  const contacts = [];
  const incomingIndices = new Map(incoming.cells.map((cell, index) => [cell.join(","), index]));
  if (incomingIndices.size !== incoming.cells.length) return null;
  for (const arrow of stage.arrows) {
    if (arrow.id === incoming.id) continue;
    for (let a = 0; a < arrow.cells.length; a++) {
      const b = incomingIndices.get(arrow.cells[a].join(","));
      if (b !== undefined) contacts.push({ arrow, a, b });
      if (contacts.length > 1) return null;
    }
  }
  if (contacts.length !== 1) return null;
  const { arrow, a, b } = contacts[0];
  const cells = [...arrow.cells.slice(0, a + 1), ...incoming.cells.slice(b + 1)];
  if (cells.length < 2) return null;
  const merged = { ...structuredClone(arrow), cells: structuredClone(cells),
    head_cell: [...cells[0]], direction: directionFromCells(cells) };
  const result = structuredClone(stage);
  result.arrows = result.arrows.filter(item => item.id !== incoming.id)
    .map(item => item.id === arrow.id ? merged : item);
  return { stage: result, keptId: arrow.id, removedId: incoming.id, cell: [...arrow.cells[a]] };
}
