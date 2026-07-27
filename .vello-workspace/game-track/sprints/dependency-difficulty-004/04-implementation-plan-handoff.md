---
handoff:
  stage: implementation_plan
  status: ready_for_implementation
  next_skill: vello-game-implementation-05
  route: design_delta
  scope_authorization: confirmed
  completion_mode: deliver_only
  required_inputs:
    - "02-design-handoff.md"
    - "03-system-spec-handoff.md"
    - "../../current-design/current-design.yaml"
  execution_groups:
    - id: EG-DEPENDENCY-ANALYZER-004
      bundles: [BUNDLE-GRAPH-004, BUNDLE-METRICS-004, BUNDLE-CATALOG-OUTPUT-004]
      targets: [SYS-DEPENDENCY-ANALYZER, SYS-PATH-RULE, SYS-STAGE-CATALOG]
      completion_criteria:
        - "blocker → blocked 방향의 정적 의존 그래프를 양방향 조회 형태로 제공한다"
        - "의존 깊이, 초기 추출 가능 비율, 강제 상태 비율, 평균 선택지 수를 결정적으로 산출한다"
        - "완전 해결 여부와 결정적 solution_order를 제공한다"
        - "스테이지 카탈로그가 분석 결과를 공개하되 생성 채택·재생성 동작은 바꾸지 않는다"
        - "고정 연쇄·순환 보드와 현재 세 스테이지 회귀 검증을 통과한다"
      risk: high
      verification: independent_qa
  user_gates: []
  confirmed_decisions:
    - "A만 구현하고 B는 후속 범위로 유지한다"
    - "분석 결과의 출력 구조는 B의 목표 범위 판정에서 재사용 가능해야 한다"
  deferred_items:
    - "B: 목표 범위 기반 보드 채택·재생성"
  required_next_actions:
    - "EG-DEPENDENCY-ANALYZER-004 구현 및 내장 검증"
    - "독립 QA로 전체 헤드리스 회귀와 main.tscn 기동 검증"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "tests/test_dependency_analyzer.gd"
    - "tests/test_stage_catalog.gd"
    - "tests/test_gameplay_core.gd"
    - "tests/test_playable_flow.gd"
    - "tests/test_arrow_placement.gd"
    - "main.tscn 헤드리스 기동"
  sot_updates_required:
    - "closeout에서만 current-design.yaml과 entity-ledger.yaml 갱신"
  refs:
    - "02-design-handoff.md"
    - "03-system-spec-handoff.md"
---
