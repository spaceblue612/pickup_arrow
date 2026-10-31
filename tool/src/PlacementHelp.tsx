import React, { useId, useRef } from "react";

// Shared by target inputs, comparison columns, and measured result labels.
const HELP = {
  stage1: "대상: 선택한 보드·영역에서 금지 칸과 기존 화살을 제외한 빈칸. 목표 칸 수 = 생성 전 빈칸 × 목표% ÷ 100(반올림). 실제% = 1단계 화살 점유 칸 ÷ 생성 전 빈칸 × 100. 전체 보드 생성 시 영역별 설정도 반영됩니다.",
  fill: "대상: 1단계 배치 후 남은 빈칸. 목표 칸 수 = 남은 빈칸 × 목표% ÷ 100(반올림). 실제% = 2단계 화살 점유 칸 ÷ 1단계 후 남은 빈칸 × 100. 전체 보드 점유율과는 다릅니다. 예: 1단계 30%, 2단계 실제 80%이면 최종 30 + 70 × 0.8 = 86%. 미입력 목표는 70%입니다.",
  uniformity: "대상: 2단계 화살의 시작 위치. 값이 높을수록 주변 4칸 거리 안의 점유가 적은 위치를 우선합니다. 확률 = 입력값 ÷ 100으로 12개 후보의 주변 점유 수를 비교합니다. 실제 점유율이나 빈칸 비율을 뜻하는 값은 아닙니다.",
  bends: "대상: 1단계에 새로 생성한 화살. 실제 굴곡% = 몸체의 전체 꺾임 횟수 ÷ 해당 화살들의 점유 타일 수 × 100. 생성기는 입력값으로 직선 유지 확률을 조절하므로 목표와 측정값은 다를 수 있습니다.",
  participation: "대상: 1단계에 새로 생성한 화살 사이의 막힘. 막힌 화살% = 머리 방향의 전체 직선 이동 경로가 막힌 화살 수 ÷ 1단계 화살 수 × 100. 바로 앞 칸만 검사하지 않습니다. 토글을 켜면 목표를 사용합니다.",
  blocker: "대상: 1단계에 새로 생성한 화살 사이의 막힘. 다른 화살을 막는 화살% = 하나 이상의 다른 화살 경로를 막는 화살 수 ÷ 1단계 화살 수 × 100. 여러 화살을 막아도 한 번만 세며 자기 몸만 막는 경우는 제외합니다.",
  arrows: "전체 보드는 모든 화살 수입니다. 영역은 머리가 영역 안에 있는 화살 수입니다. 몸체만 영역을 지나가는 화살은 화살 수에는 포함하지 않지만 점유 칸에는 포함합니다.",
  coverage: "대상: 선택한 보드·영역의 금지 칸을 제외한 모든 칸. 배치 점유율% = 기존·1단계·2단계 화살이 차지한 고유 칸 수 ÷ 배치 가능한 칸 수 × 100. 영역 밖의 몸체는 제외합니다.",
  empty: "대상: 선택한 보드·영역. 빈 배치 칸 = 배치 가능한 칸 − 화살이 차지한 고유 칸. 배치 가능한 칸 = 대상 칸 − 금지 칸. 뒤의 분모는 배치 가능한 전체 칸 수입니다.",
  size: "전체 보드는 격자의 너비 × 높이입니다. 영역은 가장 바깥 좌표를 감싸는 사각형 크기입니다. 너비 = 최대 x − 최소 x + 1, 높이 = 최대 y − 최소 y + 1. 불규칙한 영역의 실제 칸 수와 너비 × 높이는 다를 수 있습니다.",
  length: "기초 랜덤 길이는 전체 보드·영역 공통이며 1·2단계에 사용합니다(기본 2~4칸). 지정 길이 규칙은 1단계에 적용합니다. 개수는 지정 수량, 비율은 1단계 화살 수 기준 목표입니다. 현재 비율 생성은 예상 화살 수로 수량을 추정하고 생성 후 실제 수량과 비교합니다. 영역 수량은 전체 수량에 포함합니다.",
  contact: "대상: 1단계 화살. 서로 다른 화살 타일이 상하좌우로 맞닿은 경계 수입니다. 각 경계는 한 번만 세고 같은 화살 내부의 인접은 제외합니다. 목표 비율 공식은 아직 없으며 결과의 접점 수로 표시합니다.",
  actual: "현재 작업 보드에서 다시 계산한 값입니다. 생성 후 편집·삭제·실행 취소 시에도 갱신됩니다. 단계별 실제 비율은 마지막 생성의 화살 분류를 사용합니다. 분모가 0이면 0%, 단계 기록이 없으면 —를 표시합니다.",
} as const;
export type HelpTopic = keyof typeof HELP;
export function PlacementHelp({ topic, children }: { topic: HelpTopic; children: React.ReactNode }) {
  const id = useId();
  const popup = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  function show(button: HTMLButtonElement) {
    const node = popup.current;
    if (!node) return;
    const rect = button.getBoundingClientRect();
    node.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - 332))}px`;
    node.style.top = `${Math.max(12, Math.min(rect.bottom + 6, innerHeight - 250))}px`;
    if (!node.matches(":popover-open")) node.showPopover();
  }
  function hide() { if (!pinned.current) popup.current?.hidePopover(); }
  return <>
    <button type="button" className="placement-help-label" aria-label={`${typeof children === "string" ? children : topic} 계산 설명`} aria-controls={id} onMouseEnter={event => show(event.currentTarget)} onMouseLeave={hide} onFocus={event => show(event.currentTarget)} onBlur={hide} onClick={event => { pinned.current = !pinned.current; if (pinned.current) show(event.currentTarget); else popup.current?.hidePopover(); }}>{children}</button>
    <div id={id} ref={popup} popover="auto" className="placement-help-popup" onToggle={event => { if (event.newState === "closed") pinned.current = false; }}>{HELP[topic].split(/(?<=\.)\s+/).map((line, index) => <p key={index} className={line.includes("=") ? "placement-help-formula" : undefined}>{line}</p>)}</div>
  </>;
}
