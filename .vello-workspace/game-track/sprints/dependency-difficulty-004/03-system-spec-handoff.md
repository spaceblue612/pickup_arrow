---
handoff:
  stage: system_spec
  status: ready_for_implementation_plan
  next_skill: vello-game-implementation-plan-04
  required_inputs:
    - "02-design-handoff.md"
    - "../../current-design/current-design.yaml"
  confirmed_decisions:
    - "SYS-DEPENDENCY-ANALYZER 입력은 arrows와 grid_size이며, SYS-PATH-RULE의 blocker 결과를 단일 판정 원천으로 사용한다"
    - "정적 간선은 blocker → blocked이고 blockers_by_arrow와 dependents_by_arrow를 모두 반환한다"
    - "의존 깊이는 DAG의 최장 경로 노드 수이며 순환 그래프에서는 0이다"
    - "결정적 해결 시뮬레이션은 남은 배열 순서에서 첫 추출 가능 화살을 제거한다"
    - "초기 추출 가능 비율, 강제 상태 비율, 평균 선택지 수, 전체 해결 여부와 solution_order를 반환한다"
    - "SYS-STAGE-CATALOG은 생성 완료 후 dependency_analysis를 부가 정보로 제공하되 생성 결과의 채택 여부는 바꾸지 않는다"
  changed_items:
    - "SYS-DEPENDENCY-ANALYZER: 의존 그래프와 결정적 난이도 지표 산출"
    - "SYS-STAGE-CATALOG: 생성 스테이지에 dependency_analysis 공개"
  deferred_items:
    - "B: 목표 지표 범위를 입력으로 받는 생성 후보 선별·재시도"
  required_next_actions:
    - "분석기와 고정 그래프 회귀 테스트 구현"
    - "현재 세 스테이지의 결정성·완전 해결·기존 생성 프로필 회귀 검증"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "risk=high; PATH-RULE과 분석기 간 blocker 의미 일치 검증"
    - "3노드 연쇄 보드에서 간선 2개, 깊이 3, 초기 비율 1/3, 강제 상태 비율 1.0 대조"
    - "순환 보드에서 is_acyclic=false, has_complete_solution=false 대조"
    - "동일 seed 스테이지의 dependency_analysis가 반복 호출에서 동일"
  sot_updates_required:
    - "closeout 시 A의 분석 계약과 B의 후속 범위를 current-design.yaml에 반영"
  refs:
    - "02-design-handoff.md"
---
