import { PlacementHelp } from "./PlacementHelp";
import React, { useRef, useState } from "react";
import type { Region } from "./types";

const FIELDS = {
  stage1: { label: "1단계 점유율", unit: "%", min: 0, max: 100 },
  fill: { label: "채움률", unit: "%", min: 0, max: 100 },
  uniformity: { label: "분포 균일도", unit: "%", min: 0, max: 100 },
  bends: { label: "굴곡 비율", unit: "%", min: 0, max: 100 },
  blocker: { label: "다른 화살을 막는 화살", unit: "%", min: 0, max: 100 },
  participation: { label: "막힌 화살", unit: "%", min: 0, max: 100 },
} as const;
type Field = keyof typeof FIELDS;
export type PlacementValues = Partial<Record<Field, number>>;
export type PlacementInputs = Record<string, PlacementValues>;
export type LengthRule = { id: string; length: string; amount: string; unit: "count" | "percent" };
export type LengthRules = Record<string, LengthRule[]>;
type ControlsProps = {
  lengthRules: LengthRules;
  setLengthRules: React.Dispatch<React.SetStateAction<LengthRules>>;
  baseLength: { min: string; max: string };
  setBaseLength: React.Dispatch<React.SetStateAction<{ min: string; max: string }>>;
  stats?: ReturnType<typeof import("./board-metrics.mjs").summarizePlacement>;
  regions: Region[];
  selectedId: string;
  inputs: PlacementInputs;
  onSelect: (id: string) => void;
  onChange: (id: string, field: Field, value: number | undefined) => void;
  onGenerate: () => void;
  busy: boolean;
  automaticPlacement: boolean;
  setAutomaticPlacement: (value: boolean) => void;
};

function NumericInput({
  id,
  field,
  inputs,
  onChange,
  target,
}: Pick<ControlsProps, "inputs" | "onChange"> & {
  id: string;
  field: Field;
  target: string;
}) {
  const definition = FIELDS[field];
  return (
    <input
      type="number"
      aria-label={`${target} ${definition.label}`}
      min={definition.min}
      max={definition.max}
      step={1}
      title={field === "bends" ? "꺾임 횟수 ÷ 1단계 점유 타일 수" : field === "fill" ? "미입력 시 70%" : field === "stage1" ? "대상의 배치 가능한 칸 기준" : undefined}
      placeholder={field === "fill" ? "70" : "—"}
      value={inputs[id]?.[field] ?? (field === "stage1" ? 30 : "")}
      onChange={(event) => {
        const input = event.currentTarget;
        if (input.value === "") onChange(id, field, undefined);
        else if (input.validity.valid) onChange(id, field, input.valueAsNumber);
      }}
    />
  );
}

export function PlacementSettings(
  props: ControlsProps & { onClose: () => void },
) {
  const { selectedId, regions, inputs, onChange } = props;
  const target =
    regions.find((region) => region.id === selectedId)?.name ?? "전체 보드";
  const values = inputs[selectedId] ?? {};
  const conflicts = (props.lengthRules[""] ?? []).flatMap((rule) => {
    if (rule.unit !== "count" || !rule.length || !rule.amount) return [];
    const reserved = regions.flatMap((region) => props.lengthRules[region.id] ?? [])
      .filter((item) => item.unit === "count" && item.length === rule.length && item.amount !== "")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    return reserved > Number(rule.amount)
      ? [`${rule.length}타일: 영역 지정 ${reserved}개가 전체 ${rule.amount}개를 초과합니다.`]
      : [];
  });
  function field(key: Field) {
    const { label, unit, min, max } = FIELDS[key];
    return (
      <div className="placement-field" key={key}>
        <div className="placement-field-heading">
          <span>{(["participation", "blocker"] as string[]).includes(key) && <input type="checkbox" aria-label={`${target} ${label} 사용`} checked={values[key] !== undefined} onChange={event => onChange(selectedId, key, event.target.checked ? 30 : undefined)} />}<PlacementHelp topic={key}>{label}</PlacementHelp></span>
          <span className="placement-number">
            <NumericInput
              {...props}
              id={selectedId}
              field={key}
              target={target}
            />
            <small>{unit}</small>
          </span>
        </div>
        {max !== undefined && (
          <input
            type="range"
            aria-label={`${target} ${label} 슬라이더`}
            min={min}
            max={max}
            value={values[key] ?? (key === "stage1" ? 30 : min)}
            onChange={(event) =>
              onChange(selectedId, key, event.currentTarget.valueAsNumber)
            }
          />
        )}
      </div>
    );
  }
  return (
    <section id="placement-settings" className="placement-settings" data-testid="placement-settings">
      <div className="section-heading">
        <h2>자동 배치</h2>
        <button
          className="text-button"
          aria-label="자동 배치 닫기"
          onClick={props.onClose}
        >
          닫기
        </button>
      </div>
      {props.stats && <div data-testid="placement-actual-stats">
        <div className="section-heading"><strong>{target}</strong><small>현재 배치</small></div>
        <dl className="stage-stats">
          <div title="선택한 영역 안에 머리가 있는 화살 수"><dt><PlacementHelp topic="arrows">화살표</PlacementHelp></dt><dd>{props.stats.arrowCount}<small>개</small></dd></div>
          <div title="금지 칸을 제외한 대상의 고유 점유 칸 비율"><dt><PlacementHelp topic="coverage">배치 점유율</PlacementHelp></dt><dd>{props.stats.coverage}<small>%</small></dd></div>
          <div><dt><PlacementHelp topic="empty">빈 배치 칸</PlacementHelp></dt><dd>{props.stats.empty}<small>/ {props.stats.usable}</small></dd></div>
          <div title="영역은 영역을 둘러싼 사각형의 너비와 높이"><dt><PlacementHelp topic="size">너비 × 높이</PlacementHelp></dt><dd>{props.stats.width} × {props.stats.height}</dd></div>
        </dl>
        <div className="placement-target-actual">
          <span>단계</span><span>목표</span><span><PlacementHelp topic="actual">실제</PlacementHelp></span>
          <span><PlacementHelp topic="stage1">1단계 점유율</PlacementHelp></span><span>{values.stage1 ?? 30}%</span><span>{props.stats.primaryCoverage === null ? "—" : `${props.stats.primaryCoverage}%`}</span>
          <span><PlacementHelp topic="fill">2단계 채움률</PlacementHelp></span><span>{values.fill ?? 70}%</span><span>{props.stats.fillCoverage === null ? "—" : `${props.stats.fillCoverage}%`}</span>
        </div>
      </div>}
      <label><input type="checkbox" aria-label="오른쪽 자동 재시도" checked={props.automaticPlacement} onChange={event => props.setAutomaticPlacement(event.target.checked)} />자동 재시도 · 미달 시 적용 안 함</label>
      <button className="pill primary" data-testid="placement-settings-generate" disabled={props.busy} onClick={props.onGenerate}>{props.busy ? "생성 중" : "랜덤 생성"}</button>
      <label className="placement-target">
        조절 대상
        <select
          aria-label="자동 배치 조절 대상"
          value={selectedId}
          onChange={(event) => props.onSelect(event.currentTarget.value)}
        >
          <option value="">전체 보드</option>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>보드·공간 설정</legend>
        <h3 className="placement-subheading">1단계 · 핵심 배치 공간</h3>
        {field("stage1")}
        <h3 className="placement-subheading">2단계 · 남은 빈칸 채우기</h3>
        {field("fill")}
        {field("uniformity")}
      </fieldset>
      <fieldset>
        <legend>화살 설정 · 1단계</legend>
        <div className="placement-field">
          <div className="section-heading"><strong><PlacementHelp topic="length">길이 규칙</PlacementHelp></strong><button className="pill bordered" onClick={() => props.setLengthRules(current => ({ ...current, [selectedId]: [...(current[selectedId] ?? []), { id: crypto.randomUUID(), length: "", amount: "", unit: "count" }] }))}>＋ 길이 추가</button></div>
          <h3 className="placement-subheading" title="기초 길이 범위는 전체 보드와 모든 영역에서 공통으로 사용합니다.">기초 길이 · 공통</h3>
          <div className="placement-lengths">
            {(["min", "max"] as const).map(key => <label key={key}>{key === "min" ? "최소" : "최대"}<input type="number" min="2" step="1" aria-label={`기초 랜덤 ${key === "min" ? "최소" : "최대"} 길이`} value={props.baseLength[key]} disabled={selectedId !== ""} placeholder={key === "min" ? "2" : "4"} onChange={e => props.setBaseLength(current => ({ ...current, [key]: e.target.value }))} /></label>)}
          </div>
          <h3 className="placement-subheading">1단계 · 지정 길이</h3>
          {(props.lengthRules[selectedId] ?? []).map(rule => {
            const update = (change: Partial<LengthRule>) => props.setLengthRules(current => ({ ...current, [selectedId]: (current[selectedId] ?? []).map(item => item.id === rule.id ? { ...item, ...change } : item) }));
            return <div className="placement-rule" key={rule.id}>
              <label>길이 · 타일<input type="number" min="2" step="1" value={rule.length} placeholder="—" onChange={e => update({ length: e.target.value })} /></label>
              <label>수량<input type="number" min="0" max={rule.unit === "percent" ? 100 : undefined} step={rule.unit === "percent" ? "any" : 1} value={rule.amount} placeholder="—" onChange={e => update({ amount: e.target.value })} /></label>
              <label>기준<select value={rule.unit} onChange={e => update({ unit: e.target.value as LengthRule["unit"] })}><option value="count">개</option><option value="percent">%</option></select></label>
              <button className="pill bordered" aria-label="길이 규칙 삭제" onClick={() => props.setLengthRules(current => ({ ...current, [selectedId]: (current[selectedId] ?? []).filter(item => item.id !== rule.id) }))}>×</button>
            </div>;
          })}
          {conflicts.length > 0 && <p className="placement-length-sum incomplete" role="alert">{conflicts.join(" ")}</p>}
        </div>
        {field("bends")}
        {field("participation")}
        {field("blocker")}
      </fieldset>
    </section>
  );
}

export function PlacementTable(
  props: ControlsProps & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  },
) {
  const [height, setHeight] = useState(232);
  const drag = useRef<{ pointerId: number; y: number; height: number } | null>(
    null,
  );
  const targets = [{ id: "", name: "전체 보드" }, ...props.regions];
  const target =
    targets.find(({ id }) => id === props.selectedId)?.name ?? "전체 보드";
  function resize(next: number) {
    setHeight(Math.max(130, Math.min(Math.min(360, innerHeight * 0.38), next)));
  }
  function value(id: string, name: string, field: Field) {
    return <>
      {(["participation", "blocker"] as string[]).includes(field) && <input type="checkbox" aria-label={`${name} ${FIELDS[field].label} 사용`} checked={props.inputs[id]?.[field] !== undefined} onChange={event => props.onChange(id, field, event.target.checked ? 30 : undefined)} />}
      <NumericInput {...props} id={id} target={name} field={field} />
    </>;
  }
  return (
    <details
      className="placement-dock"
      data-testid="placement-dock"
      id="placement-dock"
      open={props.open}
      style={
        { "--placement-dock-height": `${height}px` } as React.CSSProperties
      }
      onToggle={(event) => {
        if (event.currentTarget.open !== props.open)
          props.onOpenChange(event.currentTarget.open);
      }}
    >
      <summary>
        자동 배치 · 영역별 설정표
        <span>{props.regions.length}개 영역</span>
      </summary>
      <div
        className="placement-resize"
        role="separator"
        aria-label="영역별 설정표 높이 조절"
        aria-orientation="horizontal"
        aria-valuemin={130}
        aria-valuemax={Math.floor(Math.min(360, innerHeight * 0.38))}
        aria-valuenow={Math.round(Math.min(height, innerHeight * 0.38))}
        tabIndex={0}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          drag.current = {
            pointerId: event.pointerId,
            y: event.clientY,
            height: Math.min(height, innerHeight * 0.38),
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current?.pointerId === event.pointerId)
            resize(drag.current.height + drag.current.y - event.clientY);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            resize(
              Math.min(height, innerHeight * 0.38) +
                (event.key === "ArrowUp" ? 20 : -20),
            );
          }
        }}
      />
      <div className="placement-actions">
        <span
          className="placement-action-target"
          aria-live="polite"
          title={target}
        >
          생성 대상: <strong>{target}</strong>
        </span>
        <span className="placement-ui-note" id="placement-generate-status">
          {props.busy ? "생성 중" : "생성 후 실행 취소 가능"}
        </span>
        <label><input type="checkbox" checked={props.automaticPlacement} onChange={event => props.setAutomaticPlacement(event.target.checked)} />자동 재시도 · 미달 시 적용 안 함</label>
        <button
          className="pill primary"
          data-testid="placement-generate"
          aria-describedby="placement-generate-status"
          disabled={props.busy}
          onClick={props.onGenerate}
        >
          랜덤 생성
        </button>
      </div>
      <div className="placement-table-scroll">
        <table aria-label="영역별 생성 목표 비교">
          <thead>
            <tr className="placement-column-groups">
              <th scope="col" rowSpan={2}>대상</th>
              <th scope="colgroup" colSpan={3}>보드·공간 설정</th>
              <th scope="colgroup" colSpan={5}>화살 설정 · 1단계</th>
            </tr>
            <tr>
              <th scope="col"><PlacementHelp topic="stage1">1단계 점유율 %</PlacementHelp></th>
              <th scope="col"><PlacementHelp topic="fill">2단계 채움률 %</PlacementHelp></th>
              <th scope="col"><PlacementHelp topic="uniformity">2단계 균일도 %</PlacementHelp></th>
              <th scope="col">
                <PlacementHelp topic="length">길이 규칙</PlacementHelp>
              </th>
              <th scope="col"><PlacementHelp topic="bends">굴곡 비율 %</PlacementHelp></th>
              <th scope="col"><PlacementHelp topic="participation">막힌 화살 %</PlacementHelp></th>
              <th scope="col"><PlacementHelp topic="blocker">다른 화살을 막는 화살 %</PlacementHelp></th>
              <th scope="col"><PlacementHelp topic="contact">맞물림 · 결과 지표</PlacementHelp></th>
            </tr>
          </thead>
          <tbody>
            {targets.map(({ id, name }) => (
              <tr
                key={id}
                className={id === props.selectedId ? "selected" : ""}
                data-placement-region={id}
              >
                <th scope="row">
                  <button
                    className="placement-row-target"
                    aria-pressed={id === props.selectedId}
                    onClick={() => props.onSelect(id)}
                  >
                    {name}
                  </button>
                </th>
                <td>{value(id, name, "stage1")}</td>
                <td>{value(id, name, "fill")}</td>
                <td>{value(id, name, "uniformity")}</td>
                <td>
                  {(props.lengthRules[id] ?? []).length ? (props.lengthRules[id] ?? []).map(rule => <div key={rule.id}>{rule.length || "—"}타일 · {rule.amount || "—"}{rule.unit === "count" ? "개" : "% 목표"}</div>) : "기초 랜덤"}
                </td>
                <td>{value(id, name, "bends")}</td>
                <td>{value(id, name, "participation")}</td>
                <td>{value(id, name, "blocker")}</td>
                <td>결과 접점 수</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
