---
handoff:
  stage: system_spec
  status: ready_for_implementation_plan
  next_skill: vello-game-implementation-plan-04
  required_inputs:
    - "02-design-handoff.md"
  confirmed_decisions:
    - "SYS-STAGE-CATALOG: 화살마다 id, head_cell, direction, cells를 소유하고 길이 1~20, 연결성, 셀 중복, 보드 범위, 화살 간 겹침을 검증한다"
    - "SYS-PATH-RULE: 선택 화살의 전체 cells를 direction으로 한 칸씩 평행 이동하여 모두 보드 밖으로 나갈 때까지 다른 화살 cells와의 충돌을 수집한다"
    - "SYS-ARROW-PLACEMENT: seed, grid_size, arrow_count, length_range를 받아 비중복 연결 몸통을 생성하고 전체 제거 순서가 존재하는 보드만 반환한다"
    - "SYS-BOARD-STATE: 기존 상태 전이를 유지하되 몸통 전체 데이터를 남은 화살 상태로 소유한다"
    - "SYS-TOUCH-FEEDBACK: 화살의 모든 몸통 칸을 선택 영역으로 사용하고 꺾인 몸통, 화살촉, 평행 이동 애니메이션을 표시한다"
  changed_items:
    - "SYS-STAGE-CATALOG"
    - "SYS-PATH-RULE"
    - "SYS-BOARD-STATE"
    - "SYS-TOUCH-FEEDBACK"
    - "SYS-ARROW-PLACEMENT"
  system_contracts:
    - id: SYS-STAGE-CATALOG
      inputs: [stage_definition]
      outputs: [validated_stage, validation_errors]
      state: [grid_size, arrow_definitions]
      dependencies: []
    - id: SYS-PATH-RULE
      inputs: [selected_arrow_id, remaining_arrows, grid_size]
      outputs: [is_extractable, blocking_arrow_ids, error]
      state: []
      dependencies: [SYS-STAGE-CATALOG]
    - id: SYS-ARROW-PLACEMENT
      inputs: [seed, grid_size, arrow_count, min_length, max_length]
      outputs: [arrow_definitions, solution_order, generation_error]
      state: []
      dependencies: [SYS-PATH-RULE]
    - id: SYS-BOARD-STATE
      inputs: [validated_stage, arrow_selected, animation_complete]
      outputs: [board_state, extraction_requested, blocked_feedback_requested]
      state: [remaining_arrow_definitions, pending_extraction_arrow_id, phase]
      dependencies: [SYS-STAGE-CATALOG, SYS-PATH-RULE]
    - id: SYS-TOUCH-FEEDBACK
      inputs: [touch_point, remaining_arrow_definitions, presentation_events]
      outputs: [arrow_selected, animation_complete]
      state: [blocked_arrow_id, extracting_arrow_id, extraction_offset]
      dependencies: [SYS-BOARD-STATE]
  data_flow:
    - "SYS-ARROW-PLACEMENT.arrow_definitions -> SYS-STAGE-CATALOG validation -> SYS-BOARD-STATE stage load"
    - "SYS-TOUCH-FEEDBACK.arrow_selected -> SYS-BOARD-STATE -> SYS-PATH-RULE"
    - "SYS-PATH-RULE.is_extractable -> 상태 전이 또는 막힘 피드백"
    - "SYS-TOUCH-FEEDBACK.animation_complete -> 선택 화살 전체 몸통 제거"
  required_next_actions:
    - "PLAN-SHAPE-001: 데이터 검증과 기존 스테이지 변환 실행 그룹 작성"
    - "PLAN-PATH-002: 전체 몸통 충돌 판정과 상태 통합 실행 그룹 작성"
    - "PLAN-PLACE-001: seed 기반 배치와 해결 가능성 검증 실행 그룹 작성"
    - "PLAN-PRESENT-001: 선택 및 렌더링 실행 그룹 작성"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "VERIFY-SHAPE-001: risk=high; 길이 1·20 허용, 0·21 거부, 연결되지 않거나 겹치는 몸통 거부"
    - "VERIFY-PATH-002: risk=high; 머리 경로가 비어도 몸통 경로가 충돌하면 차단"
    - "VERIFY-PLACE-001: risk=high; 고정 seed별 생성 결과의 범위·연결·비중복·해결 순서 검증"
    - "VERIFY-PRESENT-001: risk=high; 몸통 어느 칸이든 선택되고 전체 모양이 같은 방향으로 이동"
  sot_updates_required:
    - "closeout에서 변경된 SYS-* 계약과 SYS-ARROW-PLACEMENT를 current-design.yaml에 반영"
  refs:
    - "02-design-handoff.md"
---
