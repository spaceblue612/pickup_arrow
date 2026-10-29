// Editor preview geometry only. Godot remains authoritative for placement validity.
export const DRAG_THRESHOLD = 5;
export const sameCell = (a, b) => a[0] === b[0] && a[1] === b[1];
export function translateCells(cells, offset) {
  return cells.map(([x, y]) => [x + offset[0], y + offset[1]]);
}
export function directionFromCells(cells) {
  const [a, b] = cells;
  return a[0] > b[0]
    ? "RIGHT"
    : a[0] < b[0]
      ? "LEFT"
      : a[1] > b[1]
        ? "DOWN"
        : "UP";
}
export function appendStroke(path, target) {
  const result = path.map((c) => [...c]);
  while (
    result.length &&
    !sameCell(result.at(-1), target) &&
    result.length < 10000
  ) {
    const last = result.at(-1),
      delta = [target[0] - last[0], target[1] - last[1]];
    const axis = Math.abs(delta[0]) >= Math.abs(delta[1]) ? 0 : 1;
    const next = [...last];
    next[axis] += Math.sign(delta[axis]);
    if (result.length > 1 && sameCell(next, result.at(-2))) {
      result.pop();
      continue;
    }
    if (result.some((c) => sameCell(c, next))) break;
    result.push(next);
  }
  return result;
}
export function rotateGroup(cells, pivotIndex, part, clockwise) {
  const pivot = cells[pivotIndex];
  return cells.map((c, i) => {
    if (!(part === "head" ? i < pivotIndex : i > pivotIndex)) return [...c];
    const x = c[0] - pivot[0],
      y = c[1] - pivot[1];
    return clockwise
      ? [pivot[0] - y, pivot[1] + x]
      : [pivot[0] + y, pivot[1] - x];
  });
}
export function bendInfo(cells, index) {
  if (index <= 0 || index >= cells.length - 1) return null;
  const axis = [
    cells[index][0] - cells[index - 1][0],
    cells[index][1] - cells[index - 1][1],
  ];
  const next = [
    cells[index + 1][0] - cells[index][0],
    cells[index + 1][1] - cells[index][1],
  ];
  if (axis[0] * next[0] + axis[1] * next[1] !== 0) return null;
  let anchor = index - 1;
  while (anchor > 0) {
    const v = [
      cells[anchor][0] - cells[anchor - 1][0],
      cells[anchor][1] - cells[anchor - 1][1],
    ];
    if (!sameCell(v, axis)) break;
    anchor--;
  }
  let tailAnchor = index + 1;
  while (tailAnchor < cells.length - 1) {
    const v = [
      cells[tailAnchor + 1][0] - cells[tailAnchor][0],
      cells[tailAnchor + 1][1] - cells[tailAnchor][1],
    ];
    if (!sameCell(v, next)) break;
    tailAnchor++;
  }
  return {
    anchor,
    axis,
    length: index - anchor,
    tailAnchor,
    nextAxis: next,
    nextLength: tailAnchor - index,
  };
}
function segmentLength(requested, endpointAttached) {
  // Both endpoints follow the same crossing rule; internal bends keep one edge.
  return endpointAttached
    ? requested === 0
      ? 1
      : requested
    : Math.max(1, requested);
}
export function resizeBend(cells, index, delta) {
  const info = bendInfo(cells, index);
  if (!info) return cells.map((c) => [...c]);
  // Each group follows only perpendicular to its adjoining straight segment.
  // The dragged bend can therefore move on both axes without moving the whole arrow.
  const requestedLength =
    info.length +
    Math.max(
      -999,
      Math.min(
        999,
        Math.round(delta[0] * info.axis[0] + delta[1] * info.axis[1]),
      ),
    );
  const headLength = segmentLength(requestedLength, info.anchor === 0);
  const before = headLength - info.length;
  const requestedTailLength =
    info.nextLength -
    Math.max(
      -999,
      Math.min(
        999,
        Math.round(delta[0] * info.nextAxis[0] + delta[1] * info.nextAxis[1]),
      ),
    );
  const tailLength = segmentLength(
    requestedTailLength,
    info.tailAnchor === cells.length - 1,
  );
  const after = info.nextLength - tailLength;
  if (
    cells.length +
      Math.abs(headLength) -
      info.length +
      Math.abs(tailLength) -
      info.nextLength >
    10000
  )
    return cells.map((c) => [...c]);
  const prefixShift = info.nextAxis.map((v) => v * after);
  const suffixShift = info.axis.map((v) => v * before);
  const result = cells
    .slice(0, info.anchor + 1)
    .map((c) => [c[0] + prefixShift[0], c[1] + prefixShift[1]]);
  const anchor = result.at(-1);
  for (let n = 1; n <= Math.abs(headLength); n++)
    result.push([
      anchor[0] + info.axis[0] * n * Math.sign(headLength),
      anchor[1] + info.axis[1] * n * Math.sign(headLength),
    ]);
  const pivot = result.at(-1);
  for (let n = 1; n <= Math.abs(tailLength); n++)
    result.push([
      pivot[0] + info.nextAxis[0] * n * Math.sign(tailLength),
      pivot[1] + info.nextAxis[1] * n * Math.sign(tailLength),
    ]);
  for (const c of cells.slice(info.tailAnchor + 1))
    result.push([c[0] + suffixShift[0], c[1] + suffixShift[1]]);
  return result;
}
export function extendEndpoint(cells, stroke, part) {
  // Work head-first or tail-first so the grabbed endpoint is always last.
  // Recompute from the drag snapshot: retracing the stroke restores trimmed cells.
  const result = cells.map((c) => [...c]);
  if (part === "head") result.reverse();
  for (const next of stroke.slice(1)) {
    if (result.length > 1 && sameCell(next, result.at(-2))) {
      if (result.length <= 2) break;
      result.pop();
    } else result.push([...next]);
  }
  return part === "head" ? result.reverse() : result;
}
