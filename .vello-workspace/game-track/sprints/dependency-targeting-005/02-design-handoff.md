---
handoff:
  stage: design
  status: ready_for_system_spec
  next_skill: vello-game-system-spec-03
  required_inputs:
    - "../dependency-difficulty-004/08-sprint-closeout.yaml"
    - "../../current-design/current-design.yaml"
  confirmed_decisions:
    - "BALANCE-DEPENDENCY-TARGETING-005: 기존 길이·빈칸 프로필을 유지하면서 A 분석값이 목표 범위에 든 생성 후보만 채택한다"
    - "STAGE-001 목표: dependency_depth 2..4, initial_extractable_ratio 0.50..1.00, forced_state_ratio 0.00..0.25"
    - "STAGE-002 목표: dependency_depth 3..5, initial_extractable_ratio 0.30..0.60, forced_state_ratio 0.10..0.40"
    - "STAGE-003 목표: dependency_depth 4..8, initial_extractable_ratio 0.00..0.40, forced_state_ratio 0.20..1.00"
    - "후보 seed는 기준 seed와 후보 index로 결정적으로 파생하고 최대 64개 후보를 검사한다"
    - "64개 후보가 모두 범위를 벗어나면 최선 후보를 묵인하지 않고 스테이지 생성 실패를 반환한다"
    - "dependency_depth, initial_extractable_ratio, forced_state_ratio만 채택 조건이며 average_choice_count는 관찰 지표로 유지한다"
  changed_items:
    - "BALANCE-DEPENDENCY-TARGETING-005: 스테이지별 의존 난이도 목표 범위"
    - "SYS-DEPENDENCY-TARGETING: 결정적 후보 생성·분석·채택"
    - "SYS-STAGE-CATALOG: 목표 프로필과 선택 결과 공개"
  required_next_actions:
    - "목표 프로필 검증, 후보 seed 파생, 한도·실패 반환 계약을 system spec으로 확정"
    - "생성기·분석기·카탈로그 경계의 독립 QA 계획 수립"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "기존 스테이지별 생성 설정으로 각 1,000개 표본에서 목표 후보 통과율 STAGE-001=64.7%, STAGE-002=47.6%, STAGE-003=19.5%"
    - "동일 기준 seed와 목표 프로필에서 선택 seed·시도 횟수·화살·분석 결과가 동일해야 한다"
    - "각 스테이지가 길이·빈칸·완전 해결 조건과 새 의존 목표 범위를 동시에 만족해야 한다"
    - "달성 불가능한 목표에서는 정확히 한도까지 검사한 뒤 오류를 반환해야 한다"
  sot_delta_refs:
    - "SOT-005-DEPENDENCY-TARGET-PROFILES"
    - "SOT-005-DEPENDENCY-APPLICATION"
    - "SOT-005-DEPENDENCY-TARGETING-SYSTEM"
    - "SOT-005-STAGE-CATALOG-OUTPUT"
  refs:
    - "../dependency-difficulty-004/08-sprint-closeout.yaml"
    - "../../current-design/current-design.yaml"
---
