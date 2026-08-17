---
handoff:
  stage: system_spec
  status: ready_for_implementation_plan
  next_skill: vello-game-implementation-plan-04
  goal_alignment:
    parent_goal_refs: [generation.acceptance_contract, balance.authoring.metric_catalog.configurable_fields]
    change_goal: "스테이지별 밸런스 profile의 모든 필수 수치를 보존하면서 STAGE-007~010 생성 시간을 각각 10초 미만으로 단축한다."
    relation: extend
    preserved_outcomes: ["완전한 풀이와 무교착", "fixed 결정성과 random 다양성", "target_empty_ratio", "의존성 목표", "기존 소형·마스크 보드 동작"]
    affected_outcomes: ["대형 보드 생성 성능", "profile 형상·분산 필드", "생성 후보 합격 조건", "스프레드시트·JSON 데이터 흐름"]
  required_inputs: [02-design-handoff.md, sot-delta.yaml]
  confirmed_decisions:
    - id: SYS-BALANCE-SHEET-LIFECYCLE
      responsibility: "stage_profiles에서 분산·길이·굴곡 필드를 스테이지별로 편집·검증·게시한다."
      input: [stage_profile_rows]
      output: [validated_profile_payload]
      failure: "누락·타입·범위·교차 조건 오류가 있으면 기존 정상 게시본을 보존하고 게시를 거절한다."
    - id: SYS-BALANCE-SYNC
      responsibility: "신규 필드를 canonical JSON에 포함하고 원격 게시본과 로컬 snapshot을 동일한 스키마로 검증한다."
      input: [validated_profile_payload]
      output: [data/stage_balance.json]
      failure: "신규 필드를 생략하거나 코드 기본값으로 보완하지 않는다."
    - id: SYS-STAGE-CATALOG
      responsibility: "profile의 점유·분산·길이·굴곡·의존성 필드를 교차 검증하고 생성 경로에 손실 없이 전달한다."
      input: [stage_profile, runtime_seed]
      output: [validated_generation_profile, stage_definition]
      failure: "필수 수치를 만족하지 못한 생성 결과는 플레이 가능한 stage로 반환하지 않는다."
    - id: SYS-ARROW-PLACEMENT
      responsibility: "외곽 우선 배치 없이 전체 배치 가능 영역을 사용해 profile의 점유·분산·길이·굴곡 조건을 구성 단계에서 만족하는 결정적 후보를 만든다."
      input: [grid_size, blocked_cells, seed, placement_profile]
      output: [arrows, solution_order, generation_metrics, shape_metrics]
      invariants: ["모든 셀 비중첩", "profile target_empty_ratio 허용 오차 1셀", "분산·길이·굴곡 profile 조건", "동일 입력의 동일 결과"]
    - id: SYS-DEPENDENCY-TARGETING
      responsibility: "형상 합격 후보에 대해 완전한 풀이·무교착·의존성 범위를 검증하고 모든 필수 조건을 통과한 후보만 선택한다."
      input: [placement_candidate, dependency_target, max_candidate_attempts]
      output: [accepted_candidate, dependency_analysis, acceptance_metrics]
      failure: "성능이나 다른 점수로 실패한 밸런스 조건을 상쇄하지 않는다."
  changed_items: [SYS-BALANCE-SHEET-LIFECYCLE, SYS-BALANCE-SYNC, SYS-STAGE-CATALOG, SYS-ARROW-PLACEMENT, SYS-DEPENDENCY-TARGETING]
  removed_items: []
  deferred_items: []
  required_next_actions: ["공유 profile 스키마와 생성 합격 판정을 하나의 실행 그룹으로 구현", "STAGE-007~010 성능·밸런스 통합 검증"]
  blockers: []
  decisions_needed: []
  verification_requirements: ["Sheets·Apps Script·로컬 schema 동등성", "신규 필드 fail-closed", "profile별 점유·분산·길이·굴곡 assertion", "완전한 풀이·의존성·결정성 회귀", "STAGE-007~010 각각 10초 미만", "MG-VISUAL-001 사용자 확인"]
  sot_delta_refs: [MAP-GEN-ACCEPTANCE-012, MAP-GEN-SHAPE-BALANCE-012]
  refs: [02-design-handoff.md, sot-delta.yaml]
---
