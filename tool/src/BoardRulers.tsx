import React from "react";
import type { Camera, Viewport } from "./board-camera.mjs";
import type { Cell } from "./types";

type Props = {
  camera: Camera;
  viewport: Pick<Viewport, "width" | "height">;
  grid: Cell;
  selected: Cell | null;
  onSelect: (axis: 0 | 1, value: number) => void;
};

export function BoardRulers({ camera, viewport, grid, selected, onSelect }: Props) {
  const scale = camera.scale * camera.zoom;
  function labels(axis: 0 | 1) {
    const origin = axis === 0 ? camera.x : camera.y;
    const size = axis === 0 ? viewport.width : viewport.height;
    const spacing = 40 * scale;
    const step = Math.max(1, Math.ceil(26 / spacing));
    const start = Math.max(1, Math.ceil(origin / 40 + 0.5));
    const end = Math.min(grid[axis], Math.floor((origin + size / scale) / 40 + 0.5));
    const items = [];
    for (let value = start; value <= end; value++) {
      const active = selected?.[axis] === value;
      if ((value - 1) % step !== 0 && !active) continue;
      const position = ((value - 0.5) * 40 - origin) * scale;
      items.push(<button
        key={value}
        type="button"
        className={active ? "active" : undefined}
        style={axis === 0 ? { left: position } : { top: position }}
        aria-label={`${axis === 0 ? "열" : "행"} ${value}`}
        aria-pressed={active}
        onClick={() => onSelect(axis, value)}
      >{value}</button>);
    }
    return items;
  }
  return <>
    <div className="board-ruler-corner" aria-hidden="true">칸</div>
    <div className="board-ruler board-ruler-columns" aria-label="열 눈금">{labels(0)}</div>
    <div className="board-ruler board-ruler-rows" aria-label="행 눈금">{labels(1)}</div>
    {selected && <output className="board-coordinate" aria-label="선택 좌표">열 {selected[0]} · 행 {selected[1]}</output>}
  </>;
}
