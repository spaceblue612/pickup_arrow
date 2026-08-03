---
handoff:
  stage: implementation
  status: delivery_complete
  next_skill: vello-game-sprint-closeout-08
  completed_groups:
    - EG-BALANCE-SCHEMA-V2-008
    - EG-MAP-GENERATION-CONTROLLER-008
    - EG-RANDOM-STAGE-GAME-FLOW-008
    - EG-BALANCE-PREVIEW-MODE-008
    - EG-DIFFICULTY-TARGETING-V2-008
    - EG-FIXED-CANDIDATE-PREVIEW-V2-008
    - EG-BOARD-VIEWPORT-ZOOM-V2-008
  remaining_independent_qa: []
  pending_user_gates: []
  required_inputs:
    - "04-implementation-plan-handoff.md"
    - "sot-delta.yaml"
  confirmed_decisions:
    - "모든 채택 후보는 생성기와 analyzer의 전체 solution_order와 무교착 판정을 통과한다"
    - "dependency depth는 배치 backbone으로 유도하고 depth·initial-extractable만 soft target으로 점수화한다"
    - "exact target이 없으면 완전 풀이 후보 중 closest-valid를 선택하고 forced-state는 관측만 한다"
    - "fixed preview는 candidate seed를 순차 변경하며 Sheets나 snapshot에 자동 기록하지 않는다"
    - "현재 UI 기준 보드 clip은 화면 전체 폭과 y=150..viewport_height-90을 사용하고 0.25x..2.0 focus zoom을 제공한다"
  changed_items:
    - "scripts/arrow_placement.gd"
    - "scripts/dependency_analyzer.gd"
    - "scripts/dependency_targeting.gd"
    - "scripts/map_generation_controller.gd"
    - "scripts/main.gd"
    - "scripts/balance_preview.gd"
    - "scripts/board_viewport.gd"
    - "balance_preview.tscn"
    - "tools/balance_sheet/apps_script/Code.gs"
    - "tools/balance_sheet/schema.mjs"
    - "tests/test_arrow_placement.gd"
    - "tests/test_dependency_targeting.gd"
    - "tests/test_dependency_targeting_large_board.gd"
    - "tests/test_balance_preview.gd"
    - "tests/test_map_generation_controller.gd"
    - "tests/test_stage_catalog.gd"
    - "tests/test_playable_flow.gd"
  deferred_items:
    - "preview candidate seed의 Google Sheets 자동 writeback"
    - "정식 홈 이동·스테이지 선택 UX"
  required_next_actions:
    - "스프린트 closeout을 실행한다"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "PASS: test_gameplay_core.gd, test_stage_catalog.gd, test_playable_flow.gd, test_arrow_placement.gd"
    - "PASS: dependency analyzer·targeting·large-board, map controller, preview, board foundation 회귀"
    - "PASS: Node balance tests와 Apps Script syntax"
    - "PASS: main.tscn과 balance_preview.tscn headless 시작, 오류·경고 없음"
    - "PASS: 확장 play_rect·zoom focus/clamp·pinch 종료·preview selection 차단 회귀"
    - "PASS: 화살 선분·연결부·화살촉 play_rect clipping과 필수 gameplay 회귀"
    - "PASS: preview metrics 기본 접힘·토글과 preview scene 시작 오류·경고 없음"
  sot_delta_refs:
    - SOT-008-MAP-GENERATION-MODE-RULE-V2
    - SOT-008-DIFFICULTY-TARGETING-V2
    - SOT-008-BALANCE-PREVIEW-MODE-V2
    - SOT-008-RANDOM-STAGE-004-V2
    - SOT-008-BOARD-VIEWPORT-NAVIGATION-V2
  refs:
    - "04-implementation-plan-handoff.md"
    - "03-system-spec-handoff.md"
    - "sot-delta.yaml"
---
