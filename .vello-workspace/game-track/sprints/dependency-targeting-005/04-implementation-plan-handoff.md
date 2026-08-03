---
handoff:
  stage: implementation_plan
  status: ready_for_implementation
  next_skill: vello-game-implementation-05
  route: design_delta
  scope_authorization: confirmed
  completion_mode: deliver_only
  required_inputs:
    - "03-system-spec-handoff.md"
    - "../../current-design/current-design.yaml"
  execution_groups:
    - id: EG-DEPENDENCY-TARGETING-005
      bundles: [BUNDLE-TARGET-SELECTOR-005, BUNDLE-STAGE-TARGETS-005, BUNDLE-TARGET-FAILURE-005]
      targets: [SYS-DEPENDENCY-TARGETING, SYS-ARROW-PLACEMENT, SYS-DEPENDENCY-ANALYZER, SYS-STAGE-CATALOG, BALANCE-DEPENDENCY-TARGETING-005]
      completion_criteria:
        - "유효한 목표 프로필에서 결정적 후보 seed 순서로 첫 일치 보드를 채택한다"
        - "채택 보드가 세 의존 지표의 inclusive 범위와 기존 길이·빈칸·완전 해결 조건을 모두 만족한다"
        - "StageCatalog가 목표 프로필, 선택 seed, 시도 횟수, 분석 결과를 공개한다"
        - "잘못된 목표는 즉시 실패하고 달성 불가능한 목표는 지정 후보 수 검사 후 실패한다"
        - "동일 입력의 후보 선택 결과가 반복 호출에서 동일하다"
      risk: high
      verification: independent_qa
    - id: EG-LARGE-BOARD-TARGETING-005
      bundles: [BUNDLE-LARGE-BOARD-12-005, BUNDLE-LARGE-BOARD-15-005, BUNDLE-LEVEL-GUIDE-005]
      targets: [SYS-DEPENDENCY-TARGETING, QA-DEPENDENCY-TARGETING-005]
      completion_criteria:
        - "12x12와 15x15 테스트 보드에서 목표 범위를 만족하는 후보를 한도 안에 채택한다"
        - "큰 보드에서도 동일 입력의 selected_seed·attempt_count·arrows·dependency_analysis가 동일하다"
        - "채택 보드가 목표 빈칸 비율과 완전 해결 조건을 유지한다"
        - "레벨별 기존 생성 설정과 의존 목표 설정의 변경 방법을 저장소 안내 문서로 제공한다"
      risk: high
      verification: independent_qa
  user_gates: []
  confirmed_decisions:
    - "스테이지별 보정 목표와 최대 후보 수 64를 구현 기본값으로 사용한다"
    - "범위 밖 최선 후보 fallback은 구현하지 않는다"
  deferred_items:
    - "실제 플레이 데이터 기반 목표 범위 자동 보정"
    - "런타임 비동기 후보 생성"
  required_next_actions:
    - "EG-DEPENDENCY-TARGETING-005 구현 및 내장 검증"
    - "EG-LARGE-BOARD-TARGETING-005 구현 및 내장 검증"
    - "독립 QA로 새 selector와 전체 헤드리스 회귀 검증"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "tests/test_dependency_targeting.gd"
    - "tests/test_dependency_targeting_large_board.gd"
    - "tests/test_stage_catalog.gd"
    - "tests/test_dependency_analyzer.gd"
    - "tests/test_arrow_placement.gd"
    - "tests/test_gameplay_core.gd"
    - "tests/test_playable_flow.gd"
    - "main.tscn 헤드리스 기동"
  sot_delta_refs:
    - "SOT-005-DEPENDENCY-TARGET-PROFILES"
    - "SOT-005-DEPENDENCY-APPLICATION"
    - "SOT-005-DEPENDENCY-TARGETING-SYSTEM"
    - "SOT-005-STAGE-CATALOG-OUTPUT"
  refs:
    - "03-system-spec-handoff.md"
    - "02-design-handoff.md"
---
