import { moveRegion } from "./region-move.mjs";
import { findRegionEdge, edgeChange } from "./region-edge.mjs";
import type { RegionEdge } from "./region-edge.mjs";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fitCamera, preserveCamera, cameraViewBox } from "./board-camera.mjs";
import type { Camera, Viewport } from "./board-camera.mjs";
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
  translateCells,
} from "./arrow-geometry.mjs";

type Operation = {
  id: string;
  index: number;
  kind: "rotate" | "gap" | "extend" | "move" | "duplicate";
  part: "head" | "tail";
};
type Gesture = {
  kind:
    | "pan"
    | "region-move"
    | "region-edge"
    | "move"
    | "duplicate"
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
  edge?: RegionEdge;
  startPos?: Cell;
  moveOffset?: Cell;
  regionCells?: Cell[];
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
  regionPickOnly?: boolean;
  onSelect: (id: string) => void;
  onMode: (mode: BoardMode) => void;
  onEdit: (edit: BoardEdit) => Promise<boolean>;
  onRegion: (cells: Cell[]) => void;
  onSelectRegion: (id: string) => void;
  onMoveRegion: (cells: Cell[]) => void;
  onCell: (cells: Cell[], mode: "mask" | "add-region" | "remove-region") => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
  onMessage: (text: string) => void;
};
const copy = <T,>(value: T): T => structuredClone(value);
const initialCamera = (): Camera => ({ x: 0, y: 0, zoom: 1, scale: 1 });
const centers = (cells: Cell[]) =>
  cells.map(([x, y]) => `${(x - 0.5) * 40},${(y - 0.5) * 40}`).join(" ");

export function BoardEditor(p: Props) {
  const svg = useRef<SVGSVGElement>(null),
    menuRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null),
    serial = useRef(0),
    pendingRef = useRef(false);
  const [camera, setCamera] = useState<Camera>(initialCamera);
  const viewportRef = useRef<Viewport | null>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  function measureViewport(fit = false) {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const next: Viewport = {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
    };
    const previous = viewportRef.current;
    viewportRef.current = next;
    if (fit || !previous) {
      setCamera(
        fitCamera(next, [p.stage.grid_size[0] * 40, p.stage.grid_size[1] * 40]),
      );
    } else if (previous.left !== next.left || previous.top !== next.top) {
      setCamera((current) => preserveCamera(current, previous, next));
      if (gesture.current?.kind === "pan")
        gesture.current.camera = preserveCamera(
          gesture.current.camera,
          previous,
          next,
        );
    }
    if (
      !previous ||
      previous.width !== next.width ||
      previous.height !== next.height
    )
      setViewport({ width: next.width, height: next.height });
  }
  // React-driven layout changes and browser/window resizes use the same camera policy.
  useLayoutEffect(() => {
    measureViewport();
  });
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => measureViewport());
    if (svg.current) observer.observe(svg.current);
    return () => observer.disconnect();
  }, []);
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
  const [regionMovePreview, setRegionMovePreview] = useState<Cell[] | null>(null);
  const [edgeHover, setEdgeHover] = useState<RegionEdge | null>(null);
  const [edgePreview, setEdgePreview] = useState<{ cells: Cell[]; mode: "add-region" | "remove-region"; valid: boolean } | null>(null);
  const [stroke, setStroke] = useState<Cell[]>([]),
    [regionStroke, setRegionStroke] = useState<Cell[]>([]),
    [rectangle, setRectangle] = useState<[Cell, Cell] | null>(null);
  const [pending, setPending] = useState(false),
    [dragging, setDragging] = useState(false),
    [shift, setShift] = useState(false),
    [alt, setAlt] = useState(false);
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
    setEdgeHover(null);
    setEdgePreview(null);
    setRegionMovePreview(null);
    gesture.current = null;
    setDragging(false);
    setPreview(null);
    setStroke([]);
    setRegionStroke([]);
    setRectangle(null);
  }
  function finishGesture(g: Gesture, waitingForValidation = false) {
    gesture.current = null;
    setDragging(false);
    setEdgePreview(null);
    setRegionMovePreview(null);
    if (!waitingForValidation) {
      setPreview(null);
      setStroke([]);
      setRegionStroke([]);
      setRectangle(null);
    }
    // A board pan only repositions the view; a chosen edit tool remains armed.
    // All actual arrow gestures are one-shot, regardless of their result.
    if (g.kind !== "pan") {
      setOperation(null);
      if (g.operation) p.onMode("auto");
    }
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
  useLayoutEffect(() => {
    measureViewport(true);
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
  useEffect(() => {
    if (!p.editable) {
      clearTransient();
      setOperation(null);
      setContext(null);
    }
  }, [p.editable]);
  useEffect(
    () => () => {
      serial.current++;
    },
    [],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShift(e.type === "keydown");
      if (e.key === "Alt") setAlt(e.type === "keydown");
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
      setAlt(false);
      if (gesture.current) {
        const active = gesture.current;
        if (active.kind === "pan") setCamera(active.camera);
        finishGesture(active);
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
      ...camera,
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
      kind === "duplicate"
        ? "화살의 아무 부분이나 잡고 복제 후 이동 · 놓아 검사 · Esc 취소"
        : kind === "move"
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
    if (p.regionPickOnly && !e.shiftKey && !p.busy) {
      const region = p.regions.find((region) => region.cells.some((value) => sameCell(value, c)));
      p.onSelectRegion(region?.id ?? "");
      return;
    }
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return;
    let kind: Gesture["kind"];
    let chosenOperation = operation;
    if (e.shiftKey) kind = "pan";
    else {
      if (!p.editable || p.busy || (!inside(c) && !(p.mode === "region" && edgeHover))) return;
      if (p.mode === "region" && edgeHover) kind = "region-edge";
      else if (p.mode === "region" && p.regions.find((r) => r.id === p.regionId)?.cells.some((v) => sameCell(v, c))) kind = "region-move";
      else if (e.altKey && p.mode === "auto") {
        if (!target) return;
        kind = "duplicate";
        chosenOperation = {
          id: target.arrow.id,
          index: target.index,
          kind: "duplicate",
          part: "tail",
        };
      } else if (operation) {
        const arrow = p.stage.arrows.find((a) => a.id === operation.id);
        if (!arrow) return;
        const index =
          operation.kind === "extend"
            ? operation.part === "head"
              ? 0
              : arrow.cells.length - 1
            : operation.index;
        if (
          (operation.kind === "move" || operation.kind === "duplicate") &&
          target?.arrow.id !== arrow.id
        )
          return;
        if (
          operation.kind !== "rotate" &&
          operation.kind !== "move" &&
          operation.kind !== "duplicate" &&
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
    if (kind !== "pan" && (!operation || kind === "duplicate"))
      p.onSelect(target?.arrow.id ?? "");
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
      operation: kind === "region-edge" ? undefined : chosenOperation ?? undefined,
      edge: kind === "region-edge" ? edgeHover ?? undefined : undefined,
      startPos: pos,
      moveOffset: [0, 0],
      regionCells: kind === "region-move" ? copy(p.regions.find((r) => r.id === p.regionId)?.cells ?? []) : undefined,
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
    if (!g.dragged && g.kind === "duplicate") {
      setOperation(g.operation ?? null);
      p.onMessage("복제 후 이동 · 놓아 검사 · Esc 취소");
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
    if (g.kind === "region-move" && g.regionCells && g.moveOffset) {
      g.moveOffset = moveRegion(g.regionCells, g.moveOffset, g.last, c, p.regions.filter((r) => r.id !== p.regionId), p.stage.grid_size);
      g.last = c;
      setRegionMovePreview(g.regionCells.map(([x, y]) => [x + g.moveOffset![0], y + g.moveOffset![1]]));
      return;
    }
    if (g.kind === "region-edge" && g.edge && g.startPos) {
      const change = edgeChange(g.edge, (pos[0] - g.startPos[0]) * g.edge.dx + (pos[1] - g.startPos[1]) * g.edge.dy, p.regions.find((r) => r.id === p.regionId)?.cells ?? [], p.regions.filter((r) => r.id !== p.regionId), p.stage.grid_size);
      setEdgePreview(change ? { ...change, valid: true } : null);
      return;
    }
    if ((g.kind === "add-region" || g.kind === "remove-region") && inside(c)) {
      const segment = appendStroke([g.last], c);
      for (const cell of segment) if (!g.stroke.some((v) => sameCell(v, cell))) g.stroke.push(cell);
      g.last = c;
      setRegionStroke([...g.stroke]);
      return;
    }
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
    if (g.kind === "move" || g.kind === "duplicate") {
      cells = translateCells(arrow.cells, [
        c[0] - g.origin[0],
        c[1] - g.origin[1],
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
    setPreview({
      id: g.kind === "duplicate" ? "DUPLICATE-PREVIEW" : arrow.id,
      cells,
    });
  }
  async function submit(command: BoardEdit) {
    const token = ++serial.current;
    pendingRef.current = true;
    setPending(true);
    try {
      await p.onEdit(command);
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
    let waitingForValidation = false;
    try {
      update(e);
      const c = cell(point(e.clientX, e.clientY));
      if (g.kind === "pan") return;
      if (g.kind === "region-move" && g.regionCells && g.moveOffset) {
        if (g.moveOffset[0] || g.moveOffset[1]) p.onMoveRegion(g.regionCells.map(([x, y]) => [x + g.moveOffset![0], y + g.moveOffset![1]]));
        return;
      }
      if (g.kind === "region-edge" && g.edge && g.startPos) {
        const pos = point(e.clientX, e.clientY);
        const change = edgeChange(g.edge, (pos[0] - g.startPos[0]) * g.edge.dx + (pos[1] - g.startPos[1]) * g.edge.dy, p.regions.find((r) => r.id === p.regionId)?.cells ?? [], p.regions.filter((r) => r.id !== p.regionId), p.stage.grid_size);
        if (change) p.onCell(change.cells, change.mode);
        return;
      }
      if (
        (g.operation || g.kind === "move") &&
        g.dragged &&
        sameCell(c, g.origin)
      ) {
        p.onMessage("변경 없이 조작을 종료했습니다.");
        return;
      }
      if (
        g.kind === "mask" ||
        g.kind === "add-region" ||
        g.kind === "remove-region"
      ) {
        if (g.kind === "mask") { if (inside(c)) p.onCell([c], g.kind); }
        else p.onCell(g.stroke, g.kind);
        return;
      }
      if (!g.dragged && g.kind === "region" && inside(c)) {
        const region = p.regions.find((r) => r.cells.some((cell) => sameCell(cell, c)));
        if (region) {
          p.onSelectRegion(region.id);
          p.onMessage(`${region.name} 선택됨 · 영역 + / −로 칸을 수정하세요.`);
        } else p.onMessage("영역을 클릭하거나 드래그하여 새 영역을 만드세요.");
        return;
      }
      if (!g.dragged) return;
      if (!inside(c)) {
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
        p.onRegion(cells);
        return;
      }
      if (g.kind === "create") {
        if (g.stroke.length < 2) return;
        waitingForValidation = true;
        void submit({ kind: "create", source: g.source, cells: g.stroke });
        return;
      }
      if (g.kind === "move" || g.kind === "duplicate") {
        const offset: Cell = [c[0] - g.origin[0], c[1] - g.origin[1]];
        waitingForValidation = true;
        void submit({
          kind: g.kind === "duplicate" ? "duplicate" : "translate",
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
        p.onMessage("변경 없이 조작을 종료했습니다.");
        return;
      }
      waitingForValidation = true;
      void submit({ kind: "reshape", source: g.source, arrowId: g.id, cells });
    } finally {
      finishGesture(g, waitingForValidation);
    }
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
        : operation.kind === "move" || operation.kind === "duplicate"
          ? opArrow.cells
          : operation.kind === "gap"
            ? opArrow.cells
            : operation.part === "head"
              ? opArrow.cells.slice(0, operation.index + 1)
              : opArrow.cells.slice(operation.index)
      : [];
  const title = operation
    ? operation.kind === "duplicate"
      ? "복제 후 이동"
      : operation.kind === "move"
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
  const hoverLabel = alt
    ? "화살표 · Alt+드래그하여 복제 후 이동"
    : hoverKind === "head"
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
        viewBox={cameraViewBox(camera, viewport).join(" ")}
        preserveAspectRatio="none"
        style={
          hoverKind
            ? {
                cursor: alt
                  ? "copy"
                  : hoverKind === "head" || hoverKind === "tail"
                    ? "crosshair"
                    : "move",
              }
            : undefined
        }
        onPointerDown={down}
        onPointerMove={(e) => {
          if (!gesture.current) {
            const pos = point(e.clientX, e.clientY);
            const matrix = svg.current?.getScreenCTM();
            const region = p.regions.find((r) => r.id === p.regionId);
            setEdgeHover(p.mode === "region" && p.editable && !p.busy && !e.shiftKey && region && matrix ? findRegionEdge(region.cells, pos, 8 / Math.max(0.01, Math.min(Math.abs(matrix.a), Math.abs(matrix.d)))) : null);
            const target = hit(pos);
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
        onPointerLeave={() => { setHover(null); if (!gesture.current) setEdgeHover(null); }}
        onPointerUp={up}
        onPointerCancel={() => {
          const g = gesture.current;
          if (g?.kind === "pan") setCamera(g.camera);
          if (g) finishGesture(g);
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
          (r.id === p.regionId && regionMovePreview ? regionMovePreview : r.cells).map((c) => (
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
        {regionStroke.map((c) => (
          <rect key={c.join(",")} x={(c[0] - 1) * 40} y={(c[1] - 1) * 40} width="40" height="40"
            fill="rgba(255,196,102,.45)" pointerEvents="none" />
        ))}
        {(gesture.current?.kind === "region-edge" ? gesture.current.edge : edgeHover)?.cells.map((c) => {
          const edge = (gesture.current?.kind === "region-edge" ? gesture.current.edge : edgeHover)!;
          const x = (c[0] - 1) * 40, y = (c[1] - 1) * 40;
          return <line key={c.join(",")} x1={x + (edge.dx > 0 ? 40 : 0)} y1={y + (edge.dy > 0 ? 40 : 0)} x2={x + (edge.dx > 0 ? 40 : edge.dx < 0 ? 0 : 40)} y2={y + (edge.dy > 0 ? 40 : edge.dy < 0 ? 0 : 40)} stroke="#ffc466" strokeWidth="5" pointerEvents="none" />;
        })}
        {edgePreview?.cells.map((c) => <rect key={c.join(",")} x={(c[0] - 1) * 40} y={(c[1] - 1) * 40} width="40" height="40" fill={!edgePreview.valid ? "rgba(255,60,60,.6)" : edgePreview.mode === "add-region" ? "rgba(80,230,160,.55)" : "rgba(255,100,100,.55)"} pointerEvents="none" />)}
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
            if (!gesture.current) measureViewport(true);
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
              <button role="menuitem" onClick={() => arm("duplicate", "tail")}>
                복제 후 이동
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
              measureViewport(true);
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
