import React, { useRef, useState } from "react";
import type { Region } from "./types";

const FIELDS = {
  fill: { label: "채움률", unit: "%", min: 0, max: 100 },
  uniformity: { label: "분포 균일도", unit: "%", min: 0, max: 100 },
  short: { label: "짧음", unit: "%", min: 0, max: 100 },
  medium: { label: "중간", unit: "%", min: 0, max: 100 },
  long: { label: "김", unit: "%", min: 0, max: 100 },
  bends: { label: "굴곡 정도", unit: "/ 100", min: 0, max: 100 },
  wrapping: { label: "감싸기 비율", unit: "%", min: 0, max: 100 },
  participation: { label: "연쇄 참여율", unit: "%", min: 0, max: 100 },
  depth: { label: "연쇄 깊이", unit: "단계", min: 1, max: undefined },
} as const;
type Field = keyof typeof FIELDS;
export type PlacementValues = Partial<Record<Field, number>>;
export type PlacementInputs = Record<string, PlacementValues>;
type ControlsProps = {
  regions: Region[];
  selectedId: string;
  inputs: PlacementInputs;
  onSelect: (id: string) => void;
  onChange: (id: string, field: Field, value: number | undefined) => void;
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
      placeholder="—"
      value={inputs[id]?.[field] ?? ""}
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
  const lengthValues = [values.short, values.medium, values.long];
  const lengthSum = lengthValues.reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  const hasLengths = lengthValues.some((value) => value !== undefined);
  function field(key: Field) {
    const { label, unit, min, max } = FIELDS[key];
    return (
      <div className="placement-field" key={key}>
        <div className="placement-field-heading">
          <span>{label}</span>
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
            value={values[key] ?? min}
            onChange={(event) =>
              onChange(selectedId, key, event.currentTarget.valueAsNumber)
            }
          />
        )}
      </div>
    );
  }
  return (
    <section className="placement-settings" data-testid="placement-settings">
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
      <p className="placement-ui-note">UI 준비 · 생성 기능 미연결</p>
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
        <legend>공간 채우기</legend>
        {field("fill")}
        {field("uniformity")}
      </fieldset>
      <fieldset>
        <legend>화살 모양</legend>
        <div className="placement-field">
          <span>길이 구성비 (%)</span>
          <div className="placement-lengths">
            {(["short", "medium", "long"] as const).map((key) => (
              <label key={key}>
                {FIELDS[key].label}
                <NumericInput
                  {...props}
                  id={selectedId}
                  field={key}
                  target={target}
                />
              </label>
            ))}
          </div>
          <p
            className={
              "placement-length-sum" +
              (hasLengths && lengthSum !== 100 ? " incomplete" : "")
            }
            aria-live="polite"
          >
            {hasLengths
              ? `합계 ${lengthSum} / 100%`
              : "미설정 · 합계 100% 기준"}
          </p>
        </div>
        {field("bends")}
        <p className="placement-ui-note">굴곡 척도는 임시입니다.</p>
      </fieldset>
      <fieldset>
        <legend>맞물림과 연쇄</legend>
        {field("wrapping")}
        {field("participation")}
        {field("depth")}
      </fieldset>
      <p className="placement-ui-note">
        입력값은 임시이며 저장·실제 배치에 반영되지 않습니다.
      </p>
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
    return <NumericInput {...props} id={id} target={name} field={field} />;
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
        <span>{props.regions.length}개 영역 · UI 준비</span>
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
          생성 기능 준비 중
        </span>
        <button
          className="pill primary"
          data-testid="placement-generate"
          aria-describedby="placement-generate-status"
          disabled
        >
          랜덤 생성
        </button>
      </div>
      <div className="placement-table-scroll">
        <table>
          <caption>생성 목표 입력 · 실제 분석값 아님 · 빈칸은 미설정</caption>
          <thead>
            <tr>
              <th scope="col">대상</th>
              <th scope="col">채움률 %</th>
              <th scope="col">분포 균일도 %</th>
              <th scope="col">
                길이 구성비 %<small>짧음 / 중간 / 김</small>
              </th>
              <th scope="col">굴곡 정도</th>
              <th scope="col">감싸기 비율 %</th>
              <th scope="col">연쇄 참여율 %</th>
              <th scope="col">연쇄 깊이</th>
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
                <td>{value(id, name, "fill")}</td>
                <td>{value(id, name, "uniformity")}</td>
                <td>
                  <div className="placement-table-lengths">
                    {value(id, name, "short")}
                    {value(id, name, "medium")}
                    {value(id, name, "long")}
                  </div>
                </td>
                <td>{value(id, name, "bends")}</td>
                <td>{value(id, name, "wrapping")}</td>
                <td>{value(id, name, "participation")}</td>
                <td>{value(id, name, "depth")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
