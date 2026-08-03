---
handoff:
  stage: implementation_plan
  status: ready_for_implementation
  next_skill: vello-game-implementation-05
  route: full
  scope_authorization: confirmed
  completion_mode: deliver_only
  required_inputs:
    - "03-system-spec-handoff.md"
    - "02-design-handoff.md"
    - "sot-delta.yaml"
  execution_groups:
    - id: EG-BOARD-DATA-MASK-006
      bundles: [BUNDLE-STAGE-BOARD-SCHEMA-006, BUNDLE-MASKED-GENERATION-006, BUNDLE-BOARD-RUNTIME-STATE-006]
      targets: [SYS-STAGE-CATALOG, SYS-ARROW-PLACEMENT, SYS-DEPENDENCY-TARGETING, SYS-DEPENDENCY-ANALYZER, SYS-BOARD-STATE]
      completion_criteria:
        - "스테이지별 grid_size와 선택적 mask_rows가 검증 후 grid_size와 행 우선 blocked_cells로 정규화된다"
        - "각 축 1..999, 전체 1..10000 자원 가드와 잘못된 마스크·전면 차단·점유 위반이 명시적 오류로 거절된다"
        - "생성 용량과 목표 빈칸 비율이 배치 가능 셀을 기준으로 계산되고 화살의 모든 셀이 마스크를 준수한다"
        - "동일 크기·마스크·seed·프로필의 생성·의존 선택 결과가 결정적이다"
        - "BoardState가 활성 grid_size와 blocked_cells를 로드·복제·공개한다"
      risk: high
      verification: independent_qa
    - id: EG-BOARD-VIEWPORT-006
      bundles: [BUNDLE-BOARD-TRANSFORM-006, BUNDLE-VISIBLE-CELL-RENDERING-006, BUNDLE-POINTER-GESTURE-006, BUNDLE-BOARD-EDGE-EXTRACTION-006]
      targets: [SYS-BOARD-VIEWPORT, SYS-TOUCH-FEEDBACK, SYS-PATH-RULE, CORE-SNAKE-EXTRACTION-004]
      completion_criteria:
        - "9x9 기준 셀 크기로 FIT 축 중앙 정렬과 OVERFLOW 축 이동·경계 clamp를 계산한다"
        - "화면 좌표와 grid 좌표가 pan offset을 포함해 왕복하며 hit-test가 이동 후 화살을 찾는다"
        - "짧은 터치는 선택하고 누적 이동이 임계값을 넘으면 화살 위에서도 선택을 취소하고 드래그한다"
        - "렌더링은 blocked_cells를 비활성으로 표시하고 99x99·999x10에서도 가시 셀 범위만 순회한다"
        - "추출 가능 판정과 마지막 몸통 이탈 거리는 활성 직사각 보드 외곽을 사용한다"
        - "READY 이외 phase의 선택·드래그 입력 잠금과 기존 blocked feedback·stage flow를 보존한다"
      risk: high
      verification: independent_qa
  user_gates:
    - id: USER-BOARD-PAN-006
      after: EG-BOARD-VIEWPORT-006
      check: "실제 화면에서 짧은 탭 선택, 화살 위 드래그, 이동 감도, 보드 경계 고정, 시작 위치를 확인한다"
  confirmed_decisions:
    - "희소 저장·청크 렌더링은 구현하지 않고 10000셀 자원 가드와 가시 범위 렌더링을 사용한다"
    - "기존 STAGE-001~003 콘텐츠 값은 변경하지 않고 기능 계약과 테스트 fixture로 가변 보드·마스크를 검증한다"
  deferred_items:
    - "OPT-SPARSE-CHUNK-RENDERING-006"
    - "EPIC-BALANCE-AUTHORING-007"
    - "FEATURE-MAP-GENERATION-MODE-008"
    - "기존 스테이지에 가변 크기·마스크 실제 콘텐츠 적용"
  required_next_actions:
    - "EG-BOARD-DATA-MASK-006 구현 및 영향받은 자동 검증"
    - "EG-BOARD-VIEWPORT-006 구현 및 영향받은 자동 검증"
    - "독립 QA로 고위험 통합·전체 회귀 검증"
    - "자동 검증 통과 후 USER-BOARD-PAN-006 사용자 확인"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "tests/test_board_foundation.gd"
    - "tests/test_gameplay_core.gd"
    - "tests/test_stage_catalog.gd"
    - "tests/test_playable_flow.gd"
    - "tests/test_arrow_placement.gd"
    - "tests/test_dependency_analyzer.gd"
    - "tests/test_dependency_targeting.gd"
    - "tests/test_dependency_targeting_large_board.gd"
    - "main.tscn headless startup"
  sot_delta_refs:
    - "SOT-006-VARIABLE-BOARD-RULE"
    - "SOT-006-BOARD-MASK-RULE"
    - "SOT-006-BOARD-NAVIGATION-RULE"
    - "SOT-006-GENERATION-MASK-CONTRACT"
    - "SOT-006-BOARD-VIEWPORT-SYSTEM"
    - "SOT-006-STAGE-CATALOG-BOARD-CONTRACT"
  refs:
    - "03-system-spec-handoff.md"
    - "02-design-handoff.md"
    - "sot-delta.yaml"
---
