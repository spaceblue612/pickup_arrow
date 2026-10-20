import React, { useEffect, useRef, useState } from "react";
import type {
  Analysis,
  Arrow,
  BoardEdit,
  BoardMode,
  Cell,
  Region,
  Stage,
} from "./types";
import {
  appendStroke,
  bendInfo,
  directionFromCells,
  DRAG_THRESHOLD,
  extendEndpoint,
  resizeBend,
  rotateGroup,
  sameCell,
} from "./arrow-geometry.mjs";

type Camera = { x: number; y: number; zoom: number };
type Operation = {
  id: string;
  index: number;
  kind: "rotate" | "gap" | "extend" | "move";
  part: "head" | "tail";
};
type Gesture = {
  kind:
    | "pan"
    | "move"
    | "create"
    | "region"
    | "mask"
    | "add-region"
    | "remove-region"
    | "rotate"
    | "gap"
    | "extend";
  pointerId: number;
  start: Cell;
  origin: Cell;
  last: Cell;
  source: Stage;
  dragged: boolean;
  camera: Camera;
  scale: Cell;
  stroke: Cell[];
  id?: string;
  operation?: Operation;
};
type Props = {
  stage: Stage;
  regions: Region[];
  regionId: string;
  selected: string;
  mode: BoardMode;
  analysis: Analysis | null;
  free: string[];
  links: boolean;
  busy: boolean;
  editable: boolean;
  onSelect: (id: string) => void;
  onMode: (mode: BoardMode) => void;
  onEdit: (edit: BoardEdit) => Promise<boolean>;
  onRegion: (cells: Cell[]) => void;
  onCell: (cell: Cell, mode: "mask" | "add-region" | "remove-region") => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
  onMessage: (text: string) => void;
};
const copy = <T,>(value: T): T => structuredClone(value);
const initialCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
const centers = (cells: Cell[]) =>
  cells.map(([x, y]) => `${(x - 0.5) * 40},${(y - 0.5) * 40}`).join(" ");

export function BoardEditor(p: Props) {
  const svg = useRef<SVGSVGElement>(null),
    menuRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null),
    serial = useRef(0),
    pendingRef = useRef(false);
  const [camera, setCamera] = useState<Camera>(initialCamera);
  const [hover, setHover] = useState<{ id: string; index: number } | null>(
    null,
  );
  const [operation, setOperation] = useState<Operation | null>(null);
  const [context, setContext] = useState<{
    x: number;
    y: number;
    id: string;
    index: number;
  } | null>(null);
  const [preview, setPreview] = useState<{ id: string; cells: Cell[] } | null>(
    null,
  );
  const [stroke, setStroke] = useState<Cell[]>([]),
    [rectangle, setRectangle] = useState<[Cell, Cell] | null>(null);
  const [pending, setPending] = useState(false),
    [dragging, setDragging] = useState(false),
    [shift, setShift] = useState(false);
  const wheelHandler = useRef<(event: WheelEvent) => void>(() => {});

  function point(clientX: number, clientY: number): Cell {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return [0, 0];
    const value = new DOMPoint(clientX, clientY).matrixTransform(
      matrix.inverse(),
    );
    return [value.x, value.y];
  }
  const cell = (pos: Cell): Cell => [
    Math.floor(pos[0] / 40) + 1,
    Math.floor(pos[1] / 40) + 1,
  ];
  const inside = (c: Cell) =>
    c[0] >= 1 &&
    c[1] >= 1 &&
    c[0] <= p.stage.grid_size[0] &&
    c[1] <= p.stage.grid_size[1];
  function hit(pos: Cell) {
    const c = cell(pos);
    for (const arrow of p.stage.arrows) {
      const index = arrow.cells.findIndex((v) => sameCell(v, c));
      if (index >= 0) return { arrow, index };
    }
    const scale = svg.current?.getScreenCTM()?.a ?? 1;
    let best: { arrow: Arrow; index: number; distance: number } | null = null;
    for (const arrow of p.stage.arrows)
      arrow.cells.forEach((v, index) => {
        const distance =
          Math.hypot((v[0] - 0.5) * 40 - pos[0], (v[1] - 0.5) * 40 - pos[1]) *
          scale;
        if (distance <= 8 && (!best || distance < best.distance))
          best = { arrow, index, distance };
      });
    return best as { arrow: Arrow; index: number; distance: number } | null;
  }
  function clearTransient() {
    setHover(null);
    gesture.current = null;
    setDragging(false);
    setPreview(null);
    setStroke([]);
    setRectangle(null);
  }
  function cancel() {
    if (context) {
      setContext(null);
      return;
    }
    const active = gesture.current;
    if (active?.kind === "pan") {
      setCamera(active.camera);
      clearTransient();
      p.onMessage("보드 이동을 취소했습니다.");
      return;
    }
    serial.current++;
    clearTransient();
    setOperation(null);
    if (p.busy || pendingRef.current) p.onCancel();
    if (
      active ||
      operation ||
      p.mode !== "auto" ||
      pendingRef.current ||
      p.busy
    ) {
      p.onMode("auto");
      p.onMessage("진행 중인 조작을 취소했습니다. 원본은 유지됩니다.");
    } else p.onSelect("");
  }
  useEffect(() => {
    setCamera(initialCamera());
    clearTransient();
    setOperation(null);
    setContext(null);
  }, [p.stage.id, p.stage.grid_size[0], p.stage.grid_size[1]]);
  useEffect(() => {
    if (gesture.current?.kind !== "pan") clearTransient();
    setOperation(null);
    setContext(null);
  }, [p.stage]);
  useEffect(() => {
    if (p.mode !== "auto") {
      clearTransient();
      setOperation(null);
      setContext(null);
    }
  }, [p.mode]);
  useEffect(
    () => () => {
      serial.current++;
    },
    [],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShift(e.type === "keydown");
      if (
        e.type !== "keydown" ||
        e.key !== "Escape" ||
        document.querySelector("dialog[open]")
      )
        return;
      const element = e.target as HTMLElement;
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName) &&
        !gesture.current &&
        !operation &&
        !context &&
        !pendingRef.current &&
        !p.busy &&
        p.mode === "auto"
      )
        return;
      e.preventDefault();
      cancel();
    };
    const blur = () => {
      setHover(null);
      setShift(false);
      if (gesture.current) {
        const active = gesture.current;
        if (active.kind === "pan") setCamera(active.camera);
        clearTransient();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", blur);
    };
  });
  wheelHandler.current = (e) => {
    e.preventDefault();
    setHover(null);
    if (gesture.current) return;
    const anchor = point(e.clientX, e.clientY);
    const zoom = Math.max(
      0.25,
      Math.min(6, camera.zoom * Math.exp(-e.deltaY * 0.0015)),
    );
    setCamera({
      x: anchor[0] - ((anchor[0] - camera.x) * camera.zoom) / zoom,
      y: anchor[1] - ((anchor[1] - camera.y) * camera.zoom) / zoom,
      zoom,
    });
  };
  useEffect(() => {
    const element = svg.current;
    const handler = (e: WheelEvent) => wheelHandler.current(e);
    element?.addEventListener("wheel", handler, { passive: false });
    return () => element?.removeEventListener("wheel", handler);
  }, []);
  useEffect(() => {
    const rect = menuRef.current?.getBoundingClientRect();
    if (context && rect) {
      const x = Math.max(8, Math.min(context.x, innerWidth - rect.width - 8));
      const y = Math.max(8, Math.min(context.y, innerHeight - rect.height - 8));
      if (x !== context.x || y !== context.y) {
        setContext({ ...context, x, y });
        return;
      }
    }
    menuRef.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
  }, [context]);

  function arm(
    kind: Operation["kind"],
    part: Operation["part"],
    index = context?.index ?? 0,
  ) {
    if (!context?.id) return;
    setOperation({ id: context.id, index, kind, part });
    setContext(null);
    setPreview(null);
    p.onMode("auto");
    p.onMessage(
      kind === "move"
        ? "화살의 아무 부분이나 잡고 전체 이동 · 놓아 검사 · Esc 취소"
        : kind === "rotate"
          ? "강조된 그룹을 드래그하여 좌우 90° 회전 · 놓아 검사 · Esc 취소"
          : kind === "gap"
            ? "꺾임점을 좌우·위아래로 드래그하여 양쪽 간격 조절 · Esc 취소"
            : "끝점부터 이어 그리거나 몸체를 따라 줄이세요 · 최소 2칸 · Esc 취소",
    );
    svg.current?.focus();
  }
  function contextMenu(e: React.MouseEvent<SVGSVGElement>) {
    e.preventDefault();
    if (gesture.current || pendingRef.current || p.busy) return;
    const target = hit(point(e.clientX, e.clientY));
    if (!p.editable && target) return;
    setOperation(null);
    setPreview(null);
    p.onSelect(target?.arrow.id ?? "");
    setContext({
      x: Math.max(8, Math.min(innerWidth - 268, e.clientX)),
      y: Math.max(8, Math.min(innerHeight - 360, e.clientY)),
      id: target?.arrow.id ?? "",
      index: target?.index ?? 0,
    });
  }
  function down(e: React.PointerEvent<SVGSVGElement>) {
    if (
      e.button !== 0 ||
      gesture.current ||
      (pendingRef.current && !e.shiftKey)
    )
      return;
    const pos = point(e.clientX, e.clientY),
      c = cell(pos),
      target = hit(pos);
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return;
    let kind: Gesture["kind"];
    let chosenOperation = operation;
    if (e.shiftKey) kind = "pan";
    else {
      if (!p.editable || p.busy || !inside(c)) return;
      if (operation) {
        const arrow = p.stage.arrows.find((a) => a.id === operation.id);
        if (!arrow) return;
        const index =
          operation.kind === "extend"
            ? operation.part === "head"
              ? 0
              : arrow.cells.length - 1
            : operation.index;
        if (operation.kind === "move" && target?.arrow.id !== arrow.id) return;
        if (
          operation.kind !== "rotate" &&
          operation.kind !== "move" &&
          !sameCell(c, arrow.cells[index])
        ) {
          p.onMessage(
            "표시된 기준점·끝점을 잡고 드래그하세요. Esc로 취소할 수 있습니다.",
          );
          return;
        }
        kind = operation.kind;
      } else if (p.mode !== "auto") kind = p.mode;
      else if (
        target &&
        (target.index === 0 || target.index === target.arrow.cells.length - 1)
      ) {
        kind = "extend";
        chosenOperation = {
          id: target.arrow.id,
          index: target.index,
          kind: "extend",
          part: target.index === 0 ? "head" : "tail",
        };
      } else if (target && bendInfo(target.arrow.cells, target.index)) {
        kind = "gap";
        chosenOperation = {
          id: target.arrow.id,
          index: target.index,
          kind: "gap",
          part: "tail",
        };
      } else kind = target ? "move" : "create";
    }
    e.preventDefault();
    svg.current?.focus();
    setHover(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    setContext(null);
    if (kind !== "pan" && !operation) p.onSelect(target?.arrow.id ?? "");
    gesture.current = {
      kind,
      pointerId: e.pointerId,
      start: [e.clientX, e.clientY],
      origin: c,
      last: c,
      source: copy(p.stage),
      dragged: false,
      camera: { ...camera },
      scale: [matrix.a, matrix.d],
      stroke: [
        kind === "extend" && target ? target.arrow.cells[target.index] : c,
      ],
      id: chosenOperation?.id ?? target?.arrow.id,
      operation: chosenOperation ?? undefined,
    };
  }
  function update(e: React.PointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const distance = Math.hypot(e.clientX - g.start[0], e.clientY - g.start[1]);
    if (!g.dragged && distance < DRAG_THRESHOLD) return;
    if (!g.dragged && g.kind === "gap") {
      setOperation(g.operation ?? null);
      p.onMessage("양쪽 간격 조절 · 놓아 검사 · Esc 취소");
    }
    g.dragged = true;
    setDragging(true);
    if (g.kind === "pan") {
      setCamera({
        ...g.camera,
        x: g.camera.x - (e.clientX - g.start[0]) / g.scale[0],
        y: g.camera.y - (e.clientY - g.start[1]) / g.scale[1],
      });
      return;
    }
    const pos = point(e.clientX, e.clientY),
      c = cell(pos);
    g.last = c;
    if (g.kind === "create") {
      if (!inside(c)) return;
      g.stroke = appendStroke(g.stroke, c);
      setStroke(g.stroke);
      return;
    }
    if (g.kind === "region") {
      if (inside(c)) setRectangle([g.origin, c]);
      return;
    }
    const arrow = g.source.arrows.find((a) => a.id === g.id);
    if (!arrow) return;
    let cells: Cell[];
    if (g.kind === "move") {
      cells = arrow.cells.map(([x, y]) => [
        x + c[0] - g.origin[0],
        y + c[1] - g.origin[1],
      ]);
    } else if (g.operation?.kind === "extend") {
      if (!inside(c)) return;
      g.stroke = appendStroke(g.stroke, c);
      cells = extendEndpoint(arrow.cells, g.stroke, g.operation.part);
    } else if (g.operation?.kind === "gap") {
      const delta: Cell = [c[0] - g.origin[0], c[1] - g.origin[1]];
      cells = resizeBend(arrow.cells, g.operation.index, delta);
    } else if (g.operation?.kind === "rotate") {
      const pivot = arrow.cells[g.operation.index],
        neighbor =
          arrow.cells[
            g.operation.index + (g.operation.part === "head" ? -1 : 1)
          ];
      if (!neighbor) return;
      const vx = neighbor[0] - pivot[0],
        vy = neighbor[1] - pivot[1];
      const cross =
        vx * (pos[1] - (pivot[1] - 0.5) * 40) -
        vy * (pos[0] - (pivot[0] - 0.5) * 40);
      cells = rotateGroup(
        arrow.cells,
        g.operation.index,
        g.operation.part,
        cross >= 0,
      );
    } else return;
    setPreview({ id: arrow.id, cells });
  }
  async function submit(command: BoardEdit) {
    const token = ++serial.current;
    pendingRef.current = true;
    setPending(true);
    try {
      const accepted = await p.onEdit(command);
      if (token !== serial.current) return;
      if (accepted) {
        setOperation(null);
        p.onMode("auto");
      }
    } finally {
      pendingRef.current = false;
      setPending(false);
      if (token === serial.current) {
        setPreview(null);
        setStroke([]);
      }
    }
  }
  function up(e: React.PointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId || e.button !== 0) return;
    update(e);
    gesture.current = null;
    setDragging(false);
    const c = cell(point(e.clientX, e.clientY));
    if (g.kind === "pan") return;
    if (
      g.kind === "mask" ||
      g.kind === "add-region" ||
      g.kind === "remove-region"
    ) {
      if (inside(c)) p.onCell(c, g.kind);
      return;
    }
    if (!g.dragged) {
      setPreview(null);
      setStroke([]);
      setRectangle(null);
      return;
    }
    if (!inside(c)) {
      setPreview(null);
      setStroke([]);
      setRectangle(null);
      p.onMessage("보드 밖에 놓아 조작을 취소했습니다.");
      return;
    }
    if (g.kind === "region") {
      const cells: Cell[] = [];
      for (
        let y = Math.min(g.origin[1], c[1]);
        y <= Math.max(g.origin[1], c[1]);
        y++
      )
        for (
          let x = Math.min(g.origin[0], c[0]);
          x <= Math.max(g.origin[0], c[0]);
          x++
        )
          cells.push([x, y]);
      setRectangle(null);
      p.onRegion(cells);
      return;
    }
    if (g.kind === "create") {
      if (g.stroke.length < 2) {
        setStroke([]);
        return;
      }
      void submit({ kind: "create", source: g.source, cells: g.stroke });
      return;
    }
    if (g.kind === "move") {
      const offset: Cell = [c[0] - g.origin[0], c[1] - g.origin[1]];
      if (!offset[0] && !offset[1]) {
        setPreview(null);
        return;
      }
      void submit({
        kind: "translate",
        source: g.source,
        arrowId: g.id,
        offset,
      });
      return;
    }
    // Compute the final geometry synchronously; React preview state may lag one frame.
    const arrow = g.source.arrows.find((a) => a.id === g.id),
      op = g.operation;
    if (!arrow || !op) return;
    let cells: Cell[];
    if (op.kind === "extend")
      cells = extendEndpoint(arrow.cells, g.stroke, op.part);
    else if (op.kind === "gap") {
      cells = resizeBend(arrow.cells, op.index, [
        c[0] - g.origin[0],
        c[1] - g.origin[1],
      ]);
    } else {
      const pos = point(e.clientX, e.clientY),
        pivot = arrow.cells[op.index],
        neighbor = arrow.cells[op.index + (op.part === "head" ? -1 : 1)];
      const cross =
        (neighbor[0] - pivot[0]) * (pos[1] - (pivot[1] - 0.5) * 40) -
        (neighbor[1] - pivot[1]) * (pos[0] - (pivot[0] - 0.5) * 40);
      cells = rotateGroup(arrow.cells, op.index, op.part, cross >= 0);
    }
    if (JSON.stringify(cells) === JSON.stringify(arrow.cells)) {
      clearTransient();
      setOperation(null);
      p.onMode("auto");
      p.onMessage("변경 없이 조작을 종료했습니다.");
      return;
    }
    void submit({ kind: "reshape", source: g.source, arrowId: g.id, cells });
  }

  const opArrow = operation
    ? p.stage.arrows.find((a) => a.id === operation.id)
    : null;
  const contextArrow = context
    ? p.stage.arrows.find((a) => a.id === context.id)
    : null;
  const pivot =
    operation && opArrow
      ? opArrow.cells[
          operation.kind === "extend"
            ? operation.part === "head"
              ? 0
              : opArrow.cells.length - 1
            : operation.index
        ]
      : context && contextArrow
        ? contextArrow.cells[context.index]
        : null;
  const affected =
    opArrow && operation
      ? operation.kind === "extend"
        ? [pivot!]
        : operation.kind === "move"
          ? opArrow.cells
          : operation.kind === "gap"
            ? opArrow.cells
            : operation.part === "head"
              ? opArrow.cells.slice(0, operation.index + 1)
              : opArrow.cells.slice(operation.index)
      : [];
  const title = operation
    ? operation.kind === "move"
      ? "전체 이동"
      : operation.kind === "rotate"
        ? operation.index === 0 && operation.part === "tail"
          ? "전체 90° 회전 · 머리 고정"
          : `${operation.part === "head" ? "머리" : "꼬리"} 쪽 그룹 90° 회전`
        : operation.kind === "gap"
          ? "꺾임 간격 조절"
          : `${operation.part === "head" ? "머리" : "꼬리"} 연장·축소`
    : "";
  function drawArrow(arrow: Arrow, ghost = false) {
    const [x, y] = arrow.head_cell.map((v) => (v - 0.5) * 40);
    const vectors = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };
    const [dx, dy] = vectors[arrow.direction];
    return (
      <g
        key={arrow.id}
        data-arrow-id={ghost ? undefined : arrow.id}
        className={!ghost && p.selected === arrow.id ? "selected-arrow" : ""}
        opacity={!ghost && preview?.id === arrow.id ? 0.2 : 1}
      >
        <polyline
          points={centers(arrow.cells)}
          fill="none"
          stroke={
            ghost ? "#ec48bd" : p.selected === arrow.id ? "#5865f2" : "#ffffff"
          }
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${x + dx * 13},${y + dy * 13} L${x - dx * 6 - dy * 9},${y - dy * 6 + dx * 9} L${x - dx * 6 + dy * 9},${y - dy * 6 - dx * 9} Z`}
          fill={!ghost && p.free.includes(arrow.id) ? "#fff" : "#0a0d3a"}
          stroke="#fff"
          strokeWidth="2"
        />
        {!ghost && (
          <text x={x + 12} y={y - 12}>
            {arrow.id.slice(0, 12)}
          </text>
        )}
      </g>
    );
  }
  const [width, height] = p.stage.grid_size.map((n) => n * 40);
  const changing = Boolean(operation || gesture.current || pending);
  const hoveredArrow =
    hover &&
    !changing &&
    !context &&
    !shift &&
    p.editable &&
    !p.busy &&
    p.mode === "auto"
      ? p.stage.arrows.find((a) => a.id === hover.id)
      : null;
  const hoveredCell =
    hoveredArrow && hover ? hoveredArrow.cells[hover.index] : null;
  const hoverKind =
    hoveredArrow && hoveredCell && hover
      ? hover.index === 0
        ? "head"
        : hover.index === hoveredArrow.cells.length - 1
          ? "tail"
          : bendInfo(hoveredArrow.cells, hover.index)
            ? "corner"
            : "body"
      : "";
  const hoverLabel =
    hoverKind === "head"
      ? "머리 · 드래그하여 연장·축소"
      : hoverKind === "tail"
        ? "꼬리 · 드래그하여 연장·축소"
        : hoverKind === "corner"
          ? "꺾인 코너 · 드래그하여 양쪽 간격 조절"
          : "직선 몸통 · 드래그하여 전체 이동";
  return (
    <div
      className="interactive-board"
      data-editing={changing}
      data-operation={operation?.kind ?? "none"}
      data-pending={pending}
      data-camera={`${camera.x},${camera.y},${camera.zoom}`}
      data-hover-kind={hoverKind}
    >
      <svg
        ref={svg}
        tabIndex={0}
        className={
          "editable-board " +
          (shift || gesture.current?.kind === "pan" ? "panning" : "")
        }
        viewBox={`${camera.x} ${camera.y} ${width / camera.zoom} ${height / camera.zoom}`}
        style={
          hoverKind
            ? {
                cursor:
                  hoverKind === "head" || hoverKind === "tail"
                    ? "crosshair"
                    : "move",
              }
            : undefined
        }
        onPointerDown={down}
        onPointerMove={(e) => {
          if (!gesture.current) {
            const target = hit(point(e.clientX, e.clientY));
            const next = target
              ? { id: target.arrow.id, index: target.index }
              : null;
            setHover((previous) =>
              previous?.id === next?.id && previous?.index === next?.index
                ? previous
                : next,
            );
          }
          update(e);
        }}
        onPointerLeave={() => setHover(null)}
        onPointerUp={up}
        onPointerCancel={() => {
          const g = gesture.current;
          if (g?.kind === "pan") setCamera(g.camera);
          clearTransient();
        }}
        onContextMenu={contextMenu}
        aria-label="화살표 편집 보드"
      >
        <defs>
          <pattern
            id="board-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="20" cy="20" r="1.2" fill="rgba(255,255,255,.18)" />
          </pattern>
        </defs>
        <rect
          width={width}
          height={height}
          fill="#0a0d3a"
          stroke="rgba(255,255,255,.18)"
        />
        <rect width={width} height={height} fill="url(#board-grid)" />
        {p.regions.flatMap((r) =>
          r.cells.map((c) => (
            <rect
              key={r.id + c.join(",")}
              x={(c[0] - 1) * 40}
              y={(c[1] - 1) * 40}
              width="40"
              height="40"
              fill={
                r.id === p.regionId
                  ? "rgba(88,101,242,.28)"
                  : "rgba(88,101,242,.10)"
              }
              stroke="rgba(88,101,242,.35)"
            />
          )),
        )}
        {p.stage.blocked_cells.map((c) => (
          <rect
            key={c.join(",")}
            x={(c[0] - 1) * 40}
            y={(c[1] - 1) * 40}
            width="40"
            height="40"
            fill="rgba(236,72,189,.28)"
            stroke="#ec48bd"
          />
        ))}
        {p.links &&
          p.analysis &&
          p.stage.arrows.flatMap((a) =>
            (p.analysis!.blockers_by_arrow[a.id] ?? []).map((id) => {
              const b = p.stage.arrows.find((v) => v.id === id);
              return b ? (
                <line
                  key={a.id + id}
                  x1={(a.head_cell[0] - 0.5) * 40}
                  y1={(a.head_cell[1] - 0.5) * 40}
                  x2={(b.head_cell[0] - 0.5) * 40}
                  y2={(b.head_cell[1] - 0.5) * 40}
                  stroke="rgba(255,255,255,.4)"
                  strokeDasharray="3 5"
                />
              ) : null;
            }),
          )}
        {p.stage.arrows.map((a) => drawArrow(a))}
        {affected.length > 0 && (
          <polyline
            data-testid="affected-group"
            points={centers(affected)}
            fill="none"
            stroke="#ffc466"
            strokeWidth="10"
            strokeLinecap="round"
            opacity=".45"
            pointerEvents="none"
          />
        )}
        {preview &&
          preview.cells.length >= 2 &&
          drawArrow(
            {
              id: "PREVIEW",
              cells: preview.cells,
              head_cell: preview.cells[0],
              direction: directionFromCells(preview.cells),
            },
            true,
          )}
        {stroke.length >= 2 &&
          drawArrow(
            {
              id: "DRAWING",
              cells: stroke,
              head_cell: stroke[0],
              direction: directionFromCells(stroke),
            },
            true,
          )}
        {pivot && (
          <circle
            data-testid="edit-pivot"
            cx={(pivot[0] - 0.5) * 40}
            cy={(pivot[1] - 0.5) * 40}
            r="9"
            stroke="#00b0f4"
            fill="#0a0d3a"
            strokeWidth="3"
          />
        )}
        {hoveredCell && hoverKind && (
          <circle
            data-testid="hover-target"
            cx={(hoveredCell[0] - 0.5) * 40}
            cy={(hoveredCell[1] - 0.5) * 40}
            r={hoverKind === "head" ? 16 : 11}
            fill="none"
            stroke={hoverKind === "corner" ? "#f6c65b" : "#00b0f4"}
            strokeWidth="2"
            pointerEvents="none"
          />
        )}
        {rectangle && (
          <rect
            x={(Math.min(rectangle[0][0], rectangle[1][0]) - 1) * 40}
            y={(Math.min(rectangle[0][1], rectangle[1][1]) - 1) * 40}
            width={(Math.abs(rectangle[0][0] - rectangle[1][0]) + 1) * 40}
            height={(Math.abs(rectangle[0][1] - rectangle[1][1]) + 1) * 40}
            fill="rgba(88,101,242,.3)"
            stroke="#5865f2"
          />
        )}
      </svg>
      {hoverKind && (
        <div
          className="board-operation board-hover"
          data-testid="hover-hint"
          role="status"
        >
          {hoverLabel}
        </div>
      )}
      {(operation || pending || dragging) && (
        <div className="board-operation" role="status">
          {pending
            ? "배치 검사 중"
            : title ||
              (gesture.current?.kind === "pan"
                ? "보드 이동"
                : "드래그 중")}{" "}
          · Esc 취소
        </div>
      )}
      <div className="board-view-controls">
        <span>{Math.round(camera.zoom * 100)}%</span>
        <button
          onClick={() => {
            if (!gesture.current) setCamera(initialCamera());
          }}
        >
          화면 맞춤
        </button>
      </div>
      {context && (
        <div
          ref={menuRef}
          className="board-context-menu"
          role="menu"
          aria-label="화살 편집 기능"
          style={{ left: context.x, top: context.y }}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key))
              return;
            e.preventDefault();
            const items = Array.from(
              menuRef.current!.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ),
            );
            const i = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            items[
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? items.length - 1
                  : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                    items.length
            ]?.focus();
          }}
        >
          <strong>
            {contextArrow
              ? `${contextArrow.id} · 기준점 ${context.index + 1}`
              : "보드"}
          </strong>
          {contextArrow && (
            <>
              <button role="menuitem" onClick={() => arm("move", "tail", 0)}>
                전체 이동
              </button>
              <button role="menuitem" onClick={() => arm("rotate", "tail", 0)}>
                전체 90° 회전 · 머리 고정
              </button>
              <button
                role="menuitem"
                disabled={context.index === 0}
                onClick={() => arm("rotate", "head")}
              >
                머리 쪽 꺾임 추가
              </button>
              <button
                role="menuitem"
                disabled={context.index === contextArrow.cells.length - 1}
                onClick={() => arm("rotate", "tail")}
              >
                꼬리 쪽 꺾임 추가
              </button>
              <button
                role="menuitem"
                disabled={!bendInfo(contextArrow.cells, context.index)}
                onClick={() => arm("gap", "tail")}
              >
                꺾임 간격 조절
              </button>
              <button role="menuitem" onClick={() => arm("extend", "head", 0)}>
                머리 연장·축소
              </button>
              <button
                role="menuitem"
                onClick={() =>
                  arm("extend", "tail", contextArrow.cells.length - 1)
                }
              >
                꼬리 연장·축소
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  p.onDelete(context.id);
                  setContext(null);
                }}
              >
                화살표 삭제 · 실행 취소 가능
              </button>
            </>
          )}
          <button
            role="menuitem"
            onClick={() => {
              setCamera(initialCamera());
              setContext(null);
            }}
          >
            화면 맞춤
          </button>
          <small>Esc 닫기 · Shift+드래그 보드 이동</small>
        </div>
      )}
    </div>
  );
}
