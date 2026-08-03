---
handoff:
  stage: system_spec
  status: ready_for_implementation_plan
  next_skill: vello-game-implementation-plan-04
  required_inputs:
    - "02-design-handoff.md"
    - "../../current-design/current-design.yaml"
  confirmed_decisions:
    - "SYS-DEPENDENCY-TARGETING 입력은 기준 seed, 기존 배치 프로필, 의존 목표 프로필, 최대 후보 수이다"
    - "의존 목표 프로필은 dependency_depth·initial_extractable_ratio·forced_state_ratio 각각의 inclusive min/max를 소유한다"
    - "후보 index i의 seed는 base_seed + i * 1000003이며 i=0 후보는 기존 기준 seed를 보존한다"
    - "각 후보는 SYS-ARROW-PLACEMENT 생성 후 SYS-DEPENDENCY-ANALYZER로 측정하며 모든 목표 범위를 만족한 첫 후보를 채택한다"
    - "출력은 arrows, solution_order, generation_metrics, dependency_analysis, dependency_targeting_metrics, error이다"
    - "dependency_targeting_metrics는 base_seed, selected_seed, attempt_count, max_candidate_attempts, dependency_target을 제공한다"
    - "목표 프로필 또는 최대 후보 수가 잘못되면 후보 생성 전에 오류를 반환한다"
    - "후보 생성 자체가 실패하면 해당 생성 오류를 반환하고, 정상 후보가 모두 목표 밖이면 한도 도달 오류를 반환한다"
    - "SYS-STAGE-CATALOG은 selector 결과를 스테이지 정의에 연결하고 별도 재분석을 수행하지 않는다"
  changed_items:
    - "SYS-DEPENDENCY-TARGETING: 생성·분석·목표 판정 orchestration"
    - "SYS-STAGE-CATALOG: dependency_target과 dependency_targeting_metrics 공개"
  required_next_actions:
    - "selector 계약과 스테이지별 목표 프로필을 하나의 고위험 실행 그룹으로 구현"
    - "결정성, inclusive 경계, 한도 실패, 기존 생성 조건의 통합 회귀 추가"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "risk=high; SYS-ARROW-PLACEMENT, SYS-DEPENDENCY-ANALYZER, SYS-STAGE-CATALOG 통합 QA"
    - "같은 입력에서 selected_seed, attempt_count, arrows, dependency_analysis가 동일"
    - "STAGE-001~003에서 모든 목표 min/max와 기존 길이·빈칸·해결 조건 동시 충족"
    - "불가능한 유효 목표에서 max_candidate_attempts만큼 검사 후 오류"
    - "잘못된 min/max·비율·후보 수는 생성 없이 오류"
  sot_delta_refs:
    - "SOT-005-DEPENDENCY-TARGET-PROFILES"
    - "SOT-005-DEPENDENCY-APPLICATION"
    - "SOT-005-DEPENDENCY-TARGETING-SYSTEM"
    - "SOT-005-STAGE-CATALOG-OUTPUT"
  refs:
    - "02-design-handoff.md"
    - "../dependency-difficulty-004/08-sprint-closeout.yaml"
---
