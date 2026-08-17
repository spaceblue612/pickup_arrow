---
handoff:
  stage: design
  status: ready_for_system_spec_or_implementation_plan
  next_skill: vello-game-implementation-plan-04
  goal_alignment:
    parent_goal_refs: ["current-design.yaml#generation", "current-design.yaml#dependency_analysis", "04-implementation-plan-handoff.md#completion_criteria"]
    change_goal: "스테이지별 밸런스 profile의 점유·분산·길이·굴곡·의존성 수치를 필수 조건으로 보존하면서 STAGE-007~010의 생성 시간을 단축한다."
    relation: extend
    preserved_outcomes: ["10초 생성 제한", "완전한 풀이와 무교착", "dependency 목표", "fixed 결정성과 random 다양성", "상하좌우 방향 다양성"]
    affected_outcomes: ["대형 보드 생성 성능", "stage profile 형상·분산 필드", "Google Sheets와 JSON 스키마", "보충 화살 길이 정책", "중앙과 전 구역 점유", "굴곡 비율과 최소 굴곡 횟수"]
  required_inputs: ["current-design/current-design.yaml", "sot-delta.yaml#MAP-GEN-ACCEPTANCE-012"]
  confirmed_decisions: [MG-GOV-001, MG-GOV-002, MG-GOV-003, MG-GOV-004, MG-GOV-005, MG-GOV-006, MG-GOV-007, MG-FUNC-001, MG-FUNC-002, MG-FUNC-003, MG-DIFF-001, MG-SEED-001, MG-MODE-001, MG-MODE-002, MG-SPACE-001, MG-SPACE-002, MG-LENGTH-001, MG-SHAPE-001, MG-SHAPE-002, MG-SHAPE-003, MG-PERF-001, MG-VISUAL-001]
  changed_items: [generation.acceptance_contract, balance.authoring.metric_catalog.configurable_fields]
  required_next_actions: ["강화된 요구사항 계약 승인", "승인 후 기존 구현을 전 요구사항 기준으로 재검증하고 생성기를 재설계"]
  verification_requirements: ["스프레드시트와 JSON 신규 필드 fail-closed validation", "각 필수 ID별 독립 assertion", "target_empty_ratio 기반 전체 점유 검증", "profile 기반 중앙·전 구역 분산 검증", "profile 기반 긴 화살 점유 셀 비율 검증", "profile 기반 굴곡 비율·최소 굴곡 횟수 검증", "MG-VISUAL-001 사용자 확인"]
  sot_delta_refs: [MAP-GEN-ACCEPTANCE-012, MAP-GEN-SHAPE-BALANCE-012]
  refs: ["sot-delta.yaml"]
---
