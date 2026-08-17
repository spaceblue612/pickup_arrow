---
handoff:
  stage: implementation_plan
  status: ready_for_implementation
  next_skill: vello-game-implementation-05
  route: design_delta
  scope_authorization: confirmed
  goal_alignment:
    parent_goal_refs: [generation.acceptance_contract, balance.authoring.metric_catalog.configurable_fields]
    change_goal: "모든 스테이지별 밸런스 수치를 보존한 상태에서 STAGE-007~010 생성 시간을 각각 10초 미만으로 단축한다."
    relation: extend
    preserved_outcomes: ["완전한 풀이와 무교착", "fixed 결정성과 random 다양성", "target_empty_ratio", "의존성 목표", "기존 소형·마스크 보드 동작"]
    affected_outcomes: ["대형 보드 생성 성능", "스프레드시트·JSON profile", "공간 분산", "화살 길이와 굴곡"]
  execution_groups:
    - id: EG-MAP-BALANCE-CONTRACT-012
      order: 1
      targets: [SYS-BALANCE-SHEET-LIFECYCLE, SYS-BALANCE-SYNC, SYS-STAGE-CATALOG]
      completion_criteria:
        - "스프레드시트와 JSON이 스테이지별 분산·긴 화살·굴곡 수치를 동일한 필드로 제공한다"
        - "누락·타입·범위·교차 조건 오류를 게시와 런타임에서 기본값 없이 거절한다"
        - "기존 target_empty_ratio와 의존성 필드를 변경 없이 보존한다"
      risk: medium
      verification_mode: embedded
    - id: EG-MAP-GENERATION-OPTIMIZATION-012
      order: 2
      targets: [SYS-ARROW-PLACEMENT, SYS-DEPENDENCY-TARGETING]
      completion_criteria:
        - "외곽 거리 우선 셀 선택을 제거하고 profile의 전체·중앙·구역 점유 조건을 만족한다"
        - "profile의 긴 화살 셀 비중·굴곡 비율·복합 굴곡 횟수를 만족한다"
        - "완전한 풀이·무교착·의존성·결정성·random 다양성을 유지한다"
        - "STAGE-007~010 실제 build가 각각 10초 미만이다"
      risk: high
      verification_mode: embedded
  user_gates:
    - "Godot에서 STAGE-007~010이 외곽 편중과 중앙 공동 없이 profile 수치대로 고르게 분포하고 화살이 자연스럽게 얽혀 보이는지 확인"
  completion_mode: closeout
  required_inputs: [02-design-handoff.md, 03-system-spec-handoff.md, sot-delta.yaml]
  confirmed_decisions: ["밸런스 필드 fail-closed", "밸런스 완화로 얻은 속도 개선 불인정", "외곽 우선 생성 제거", "생성 단계에서 품질 조건 구성", "후보 판정에서 모든 필수 조건 독립 검증"]
  changed_items: [MAP-GEN-ACCEPTANCE-012, MAP-GEN-SHAPE-BALANCE-012]
  removed_items: []
  deferred_items: []
  required_next_actions: [EG-MAP-BALANCE-CONTRACT-012, EG-MAP-GENERATION-OPTIMIZATION-012]
  blockers: []
  decisions_needed: []
  verification_requirements: ["tools/balance_sheet Node 테스트", "stage catalog·arrow placement·dependency targeting 회귀", "STAGE-007~010 profile 합격 계약과 성능", "전체 필수 Godot 테스트", "MG-VISUAL-001 사용자 확인"]
  sot_delta_refs: [MAP-GEN-ACCEPTANCE-012, MAP-GEN-SHAPE-BALANCE-012]
  refs: [03-system-spec-handoff.md, tests/test_large_stage_generation.gd]
---
